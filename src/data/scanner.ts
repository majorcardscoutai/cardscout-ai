/**
 * Runs every active saved search: eBay → de-duplicate → value → score → save → email.
 * Called by the scheduled endpoint (/api/cron/scan) and the "Scan now" button.
 */
import { ebayConfigured, getListing, searchListings, type EbayListing, type Marketplace } from "@/lib/ebay/client";
import { scanContext, takeUsage } from "@/lib/scan-context";
import { runAsUser, runShared } from "./owner";
import type { ShipTo } from "@/lib/region";
import { pickRechecks, recheckUpdate } from "@/lib/freshness";
import { cardKey } from "@/lib/cardKey";
import { cardFromListing } from "@/lib/ebay/parse";
import { providerConfigured } from "@/lib/provider-client";
import type { CardIdentity, Sport } from "@/lib/types";
import { fillSealedValues } from "./sealed";
import { fillProviderValues, identityFromTitle, isBrandOnlySet, pendingLookups, resolveSetless } from "./provider";
import { refreshGuideSets } from "./guide";
import { alertEmailHtml, alertRecipient, emailConfigured, sendAlertEmail } from "@/lib/email";
import { isAdminEmail } from "@/lib/supabase-auth";
import { ownerId } from "./owner";
import { listScanOwners, recordUsage } from "./db";
import { excludedBy, parseExcludeWords } from "@/lib/exclude";
import { displayFx, shipToFor } from "@/lib/region";
import { dealsMessage, pushToAllDevices } from "./notify";
import { evaluateListing, revalueHit, shouldAlert, type ScanHit } from "@/lib/scan";
import { hunterRules, hunterSearchInput, liquidEnough, parseHunterSport } from "@/lib/hunter";
import {
  cardValueMap,
  profileEmail,
  existingItemIds,
  loadHunterConfig,
  insertHits,
  listRecentHits,
  markItemAlerted,
  listSavedSearches,
  loadSettings,
  markSearchRun,
  recordScanRun,
  updateHitsForItem,
} from "./db";

export interface ScanSummary {
  searches: number;
  newListings: number;
  deals: number;
  emailed: number;
  pushed: number;
  /** Listings re-checked on eBay this scan, and how many turned out sold/ended. */
  rechecked: number;
  ended: number;
  /** Cards looked up in SportsCardsPro/PriceCharting this scan, and how many got a value. */
  autoLooked: number;
  autoValued: number;
  /** Profit Hunter: vague listings fetched for item specifics, and how many became identifiable. */
  enriched: number;
  enrichHelped: number;
  /** Profit Hunter: listings whose unknown set was confirmed from the price guide. */
  setResolved: number;
  /** Cards valued instantly from your Popular sets download, and sets refreshed this run. */
  autoLocal: number;
  guideSets: number;
  errors: string[];
}

const MAX_EMAIL_ROWS = 15;
/** Stop re-checking after this long so the whole scan fits in the 60-second limit. */
const RECHECK_TIME_BUDGET_MS = 45_000;
/** Price-guide lookups (1 per second) stop after this long, leaving time for re-checks. */
const AUTO_VALUE_TIME_BUDGET_MS = 25_000;
const HUNTER_AUTO_VALUE_TIME_BUDGET_MS = 42_000;
/** Popular sets downloads stop after this long (they refresh once a day, a few per run). */
const GUIDE_TIME_BUDGET_MS = 12_000;
/** Profit Hunter: when a title is too vague, fetch the listing's item specifics (max per scan / time). */
export const ENRICH_MAX_PER_SCAN = 40;
const ENRICH_TIME_BUDGET_MS = 14_000;
/**
 * Quick Hunter runs (every 10 minutes between the hourly full runs): only the newest listings,
 * a smaller item-specifics budget and no re-checks, so eBay calls stay about where they were.
 */
export const QUICK_HUNTER_PAGE_SIZE = 100;
export const QUICK_ENRICH_MAX = 10;
const QUICK_ENRICH_TIME_BUDGET_MS = 8_000;
const ENRICH_BATCH = 5;

/** Only graded slabs are worth a lookup (the Hunter is graded-only). */
function looksGraded(title: string): boolean {
  return /\b(PSA|BGS|SGC|CGC|BECKETT)\b/i.test(title);
}

/**
 * Search results don't include item specifics. For titles too vague to identify the card, fetch the
 * listing once — sellers' Year / Set / Card Number / Grade fields usually fill the gaps.
 */
async function enrichVague(
  items: EbayListing[],
  market: Marketplace,
  shipTo: ShipTo | undefined,
  budget: { left: number; deadline: number },
  hint: { sport?: Sport },
  get: EbayGetter = getListing,
): Promise<{ items: EbayListing[]; fetched: number; helped: number }> {
  const out = [...items];
  let fetched = 0;
  let helped = 0;
  const vague = out
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => looksGraded(l.title) && cardKey(cardFromListing(l.title, l.aspects, hint).card) === null);
  for (let b = 0; b < vague.length; b += ENRICH_BATCH) {
    if (budget.left <= 0 || Date.now() > budget.deadline) break;
    const batch = vague.slice(b, b + Math.min(ENRICH_BATCH, budget.left));
    budget.left -= batch.length;
    const got = await Promise.all(batch.map(({ l }) => get(l.itemId, market, shipTo)));
    fetched += batch.length;
    got.forEach((g, j) => {
      if (!g.ok || g.data.aspects.length === 0) return;
      const i = batch[j].i;
      out[i] = { ...out[i], aspects: g.data.aspects };
      if (cardKey(cardFromListing(out[i].title, out[i].aspects, hint).card) !== null) helped++;
    });
    if (got.some((g) => !g.ok && g.code === 429)) break; // eBay daily limit
  }
  return { items: out, fetched, helped };
}

export type EbaySearcher = typeof searchListings;
export type EbayGetter = typeof getListing;

/** Options for scheduled runs over many accounts (Phase 6 step 5). */
export interface ScanOptions {
  only?: "hunter" | "hunter-quick";
  /** Shared, remembered eBay calls: the same search or listing is fetched once per run for everyone. */
  ebay?: { search: EbaySearcher; get: EbayGetter };
  /** Profit Hunter: one broad eBay search per sport + market + delivery address, shared by every account. */
  hunterGroups?: Map<string, HunterGroup>;
  /** Stop starting new work after this time (the run must fit Vercel's 60-second limit). */
  deadline?: number;
  /** Popular sets were already refreshed once for this run. */
  skipGuideRefresh?: boolean;
}

export interface HunterGroup {
  maxBudget: number;
  minPrice: number;
  auctions: boolean;
}

export function hunterGroupKey(sport: string, market: string, shipTo: ShipTo | undefined): string {
  return [sport, market, shipTo?.country ?? "", shipTo?.postcode ?? ""].join("|");
}

/** Remember eBay calls for the length of one scheduled run (shared across accounts). */
export function rememberingEbay(): { search: EbaySearcher; get: EbayGetter } {
  const searches = new Map<string, ReturnType<EbaySearcher>>();
  const items = new Map<string, ReturnType<EbayGetter>>();
  return {
    search: (input) => {
      const k = JSON.stringify(input);
      if (!searches.has(k)) searches.set(k, searchListings(input));
      return searches.get(k)!;
    },
    get: (id, market, shipTo) => {
      const k = JSON.stringify([id, market, shipTo ?? null]);
      if (!items.has(k)) items.set(k, getListing(id, market, shipTo));
      return items.get(k)!;
    },
  };
}

/** Does a listing from the shared Hunter search fit this account's own Hunter rules? */
export function fitsHunterInput(l: EbayListing, input: { maxPrice: number | null; minPrice?: number | null; format: string; exclude?: string[] }): boolean {
  const price = l.price ? Number(l.price.value) : null;
  if (price !== null && input.maxPrice !== null && price > input.maxPrice) return false;
  if (price !== null && input.minPrice && price < input.minPrice) return false;
  if (input.format === "FIXED_PRICE" && l.isAuction) return false;
  if (input.exclude?.length && excludedBy(l.title, input.exclude)) return false;
  return true;
}

/** Add up several accounts' scan results. */
export function mergeSummaries(runs: ScanSummary[]): ScanSummary {
  const out: ScanSummary = { searches: 0, newListings: 0, deals: 0, emailed: 0, pushed: 0, rechecked: 0, ended: 0, autoLooked: 0, autoValued: 0, enriched: 0, enrichHelped: 0, setResolved: 0, autoLocal: 0, guideSets: 0, errors: [] };
  for (const r of runs) {
    for (const k of Object.keys(out) as (keyof ScanSummary)[]) {
      if (k === "errors") out.errors.push(...r.errors);
      else (out[k] as number) += r[k] as number;
    }
  }
  return out;
}

export async function runAllScans(
  trigger: "schedule" | "manual" | "daily" | "hunter",
  opts: ScanOptions = {},
): Promise<ScanSummary> {
  const started = Date.now();
  const end = opts.deadline ?? Infinity;
  const until = (ms: number) => Math.min(started + ms, end);
  const search = opts.ebay?.search ?? searchListings;
  const get = opts.ebay?.get ?? getListing;
  const quick = opts.only === "hunter-quick";
  const hunterOnly = opts.only === "hunter" || quick;
  const summary: ScanSummary = { searches: 0, newListings: 0, deals: 0, emailed: 0, pushed: 0, rechecked: 0, ended: 0, autoLooked: 0, autoValued: 0, enriched: 0, enrichHelped: 0, setResolved: 0, autoLocal: 0, guideSets: 0, errors: [] };
  if (!ebayConfigured()) {
    summary.errors.push("eBay isn't connected.");
    return summary;
  }

  const [{ settings }, searches, values, hunter] = await Promise.all([loadSettings(), listSavedSearches(), cardValueMap(), loadHunterConfig()]);
  const hunterCfg = hunter.config;
  if (searches.error) {
    summary.errors.push(`Saved searches: ${searches.error}`);
    await recordScanRun({ trigger, searches: 0, newListings: 0, deals: 0, emailed: 0, error: summary.errors.join("; ") });
    return summary;
  }

  // Popular sets: refresh any older than a day (a few downloads at most), before valuing anything.
  if (providerConfigured() && !opts.skipGuideRefresh) {
    const g = await refreshGuideSets({ deadline: until(GUIDE_TIME_BUDGET_MS), maxRequests: 3 });
    summary.guideSets = g.setsUpdated;
    summary.errors.push(...g.errors);
  }

  const toEmail: (ScanHit & { searchName: string })[] = [];
  // Your own Card Values always win; automatic values fill the rest.
  const mineKeys = new Set([...values.map.values()].filter((v) => v.source === "you").map((v) => v.key));
  // A Hunter-only run has no saved searches to share time with, so it can value more cards.
  const autoDeadline = until(hunterOnly ? HUNTER_AUTO_VALUE_TIME_BUDGET_MS : AUTO_VALUE_TIME_BUDGET_MS);
  let autoError: string | null = null;
  const sportBySearch = new Map<string, Sport>(
    searches.data.filter((x) => x.kind === "hunter" && parseHunterSport(x.query)).map((x) => [x.id, parseHunterSport(x.query)!]),
  );
  const enrichBudget = quick
    ? { left: QUICK_ENRICH_MAX, deadline: until(QUICK_ENRICH_TIME_BUDGET_MS) }
    : { left: ENRICH_MAX_PER_SCAN, deadline: until(ENRICH_TIME_BUDGET_MS) };
  const autoFill = async (cards: { key: string; card: CardIdentity }[]) => {
    if (!providerConfigured() || autoError || cards.length === 0 || Date.now() > autoDeadline) return;
    const f = await fillProviderValues(cards, mineKeys, autoDeadline);
    summary.autoLooked += f.looked;
    summary.autoValued += f.matched;
    summary.autoLocal += f.local;
    for (const [k, v] of f.newValues) values.map.set(k, v);
    if (f.error) autoError = f.error;
  };

  const toRun = searches.data.filter((x) => {
    if (!x.active) return false;
    if (x.kind === "hunter") return hunterCfg.enabled && parseHunterSport(x.query) !== null && hunterCfg.sports.includes(parseHunterSport(x.query)!);
    return !hunterOnly;
  });
  for (const s of toRun) {
    if (Date.now() > end) break; // out of time — the next run carries on (oldest searches first)
    summary.searches++;
    const isHunter = s.kind === "hunter";
    // The Hunter searches one sport at a time, so every listing it finds is that sport.
    const hint: { sport?: Sport } = isHunter
      ? { sport: parseHunterSport(s.query) ?? undefined }
      : s.category === "pokemon" || s.category === "pokemonSealed"
        ? { sport: "Pokemon" }
        : {};
    const input = isHunter
      ? { ...hunterSearchInput(parseHunterSport(s.query)!, hunterCfg), ...(quick ? { limit: QUICK_HUNTER_PAGE_SIZE } : {}), shipTo: shipToFor(settings) }
      : { q: s.query, market: s.market, category: s.category, maxPrice: s.maxPrice, format: s.format, limit: 50, exclude: parseExcludeWords(s.excludeWords), grading: s.grading, shipTo: shipToFor(settings) };
    // Profit Hunter: one broad search shared by every account, then this account's own rules.
    const group = isHunter ? opts.hunterGroups?.get(hunterGroupKey(parseHunterSport(s.query)!, hunterCfg.market, input.shipTo)) : undefined;
    const broad = group
      ? { ...input, maxPrice: group.maxBudget, minPrice: group.minPrice > 0 ? group.minPrice : null, format: group.auctions ? ("ALL" as const) : ("FIXED_PRICE" as const), exclude: [] }
      : null;
    const fetched = broad ? await asShared(() => search(broad)) : await search(input);
    const r = fetched.ok && broad ? { ...fetched, data: { ...fetched.data, items: fetched.data.items.filter((l) => fitsHunterInput(l, input)) } } : fetched;
    if (!r.ok) {
      summary.errors.push(`${s.name}: ${r.error}`);
      await markSearchRun(s.id, `Error: ${r.error}`);
      if (r.code === 429) break; // daily eBay limit — stop for now
      continue;
    }
    try {
      const seen = await existingItemIds(s.id, r.data.items.map((i) => i.itemId));
      let fresh = r.data.items.filter((i) => !seen.has(i.itemId));
      if (isHunter) {
        const e = await enrichVague(fresh, input.market, input.shipTo, enrichBudget, hint, get);
        fresh = e.items;
        summary.enriched += e.fetched;
        summary.enrichHelped += e.helped;
      }
      // Titles with a set we don't know: let the guide confirm the set (player + set must both be in the title).
      if (isHunter && providerConfigured() && !autoError && Date.now() < autoDeadline) {
        const sr = await resolveSetless(fresh, hint, mineKeys, autoDeadline);
        fresh = sr.items;
        for (const [k, v] of sr.newValues) values.map.set(k, v);
        summary.setResolved += sr.identified;
      }
      // Value new listings automatically BEFORE checking them, so alerts can use the price guide.
      await autoFill(
        fresh
          .map((l) => {
            const card = cardFromListing(l.title, l.aspects, hint).card;
            const key = cardKey(card);
            return key ? { key, card: card as CardIdentity } : null;
          })
          .filter((x): x is { key: string; card: CardIdentity } => x !== null),
      );
      // Sealed products (booster boxes, hobby boxes…): your Popular sets first, then the price guide.
      if (!isHunter && providerConfigured() && !autoError && Date.now() < autoDeadline) {
        const sf = await fillSealedValues(fresh.map((l) => l.title), mineKeys, autoDeadline, hint);
        summary.autoLooked += sf.looked;
        summary.autoValued += sf.matched;
        summary.autoLocal += sf.local;
        for (const [k, v] of sf.newValues) values.map.set(k, v);
        if (sf.error) autoError = sf.error;
      }
      const rules = isHunter ? hunterRules(settings, hunterCfg) : settings;
      const hits = fresh.map((l) => {
        const h = evaluateListing(l, rules, values.map, hint);
        // Profit Hunter: only alert on cards that sell often enough to flip.
        const liquid = !isHunter || liquidEnough(h.cardKey ? values.map.get(h.cardKey) : null, hunterCfg.minSales);
        return { ...h, alerted: shouldAlert(h) && liquid };
      });
      await insertHits(s.id, hits);
      const deals = hits.filter((h) => h.meetsCriteria);
      summary.newListings += hits.length;
      summary.deals += deals.length;
      hits.filter((h) => h.alerted).forEach((h) => toEmail.push({ ...h, searchName: s.name }));
      await markSearchRun(s.id, `OK · ${hits.length} new · ${deals.length} deal${deals.length === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${s.name}: ${msg}`);
      await markSearchRun(s.id, `Error: ${msg}`);
    }
  }

  // Back-fill automatic values for listings found in earlier scans (newest first), time allowing.
  try {
    if (providerConfigured() && !autoError && Date.now() < autoDeadline) {
      // Hunter-only runs back-fill hunter listings the last runs didn't reach; full scans do yours first.
      const [mineRecent, hunterRecent] = await Promise.all([
        hunterOnly ? Promise.resolve({ data: [], error: null }) : listRecentHits(300, false, "mine"),
        listRecentHits(500, false, "hunter"),
      ]);
      const hunterHitKeys = new Set(
        hunterRecent.data.map((h) => identityFromTitle(cardFromListing, h.title, { sport: sportBySearch.get(h.searchId) })?.key).filter((k): k is string => !!k),
      );
      // Cards queued by earlier runs go first (including ones read from item specifics, not titles).
      const queued = await pendingLookups();
      await autoFill([
        ...queued,
        ...[...mineRecent.data, ...hunterRecent.data]
          .map((h) => identityFromTitle(cardFromListing, h.title, { sport: sportBySearch.get(h.searchId) }))
          // Hunter listings read as just "Topps"/"Bowman" were already handled by the set fallback.
          .filter((x) => !(x && isBrandOnlySet(x.card.set) && hunterHitKeys.has(x.key)))
          .filter((x): x is { key: string; card: CardIdentity } => x !== null),
      ]);
    }
  } catch (e) {
    autoError = e instanceof Error ? e.message : String(e);
  }
  if (autoError) summary.errors.push(`Automatic values: ${autoError}`);

  // Re-check valued listings on eBay so displayed details stay under 6 hours old
  // (eBay API licence §8.1.3), sold/ended listings drop out, and price drops can alert.
  // Quick runs skip this (the hourly full run and the 3-hourly scan keep details fresh).
  if (!quick) try {
    const [recentMine, recentHunter] = await Promise.all([listRecentHits(1000, false, "mine"), listRecentHits(1000, false, "hunter")]);
    const recent = { data: [...recentMine.data, ...recentHunter.data], error: recentMine.error ?? recentHunter.error };
    if (!recent.error) {
      const marketBySearch = new Map(searches.data.map((x) => [x.id, x.kind === "hunter" ? hunterCfg.market : x.market]));
      const hunterIds = new Set(searches.data.filter((x) => x.kind === "hunter").map((x) => x.id));
      const already = new Set(toEmail.map((h) => h.itemId));
      for (const h of pickRechecks(recent.data, settings, values.map)) {
        if (Date.now() - started > (hunterOnly ? 52_000 : RECHECK_TIME_BUDGET_MS) || Date.now() > end) break;
        const r = await get(h.itemId, marketBySearch.get(h.searchId) ?? "EBAY_US", shipToFor(settings));
        if (!r.ok && r.code === 429) break;
        if (!r.ok && r.code !== 404) continue; // temporary problem — try again next scan
        const u = recheckUpdate(r.ok ? r.data : null, settings.usdToAud);
        const err = await updateHitsForItem(h.itemId, u);
        if (err) {
          summary.errors.push(
            /checked_at|status/.test(err) ? "Listing re-check needs the one-time SQL update (see PROGRESS.md)." : `Re-check: ${err}`,
          );
          break;
        }
        summary.rechecked++;
        if (u.status === "ended") {
          summary.ended++;
          continue;
        }
        // A re-checked listing that now qualifies (e.g. the price dropped) alerts once.
        const now = revalueHit(
          { ...h, priceUsd: u.priceUsd ?? h.priceUsd, shippingUsd: u.shippingUsd ?? h.shippingUsd, endsAt: u.endsAt ?? h.endsAt, isAuction: u.isAuction ?? h.isAuction, title: u.title ?? h.title },
          hunterIds.has(h.searchId) ? hunterRules(settings, hunterCfg) : settings,
          values.map,
        );
        const alertedBefore = recent.data.some((x) => x.itemId === h.itemId && x.alerted);
        const fromHunter = hunterIds.has(h.searchId);
        const liquid = !fromHunter || liquidEnough(now.cardKey ? values.map.get(now.cardKey) : null, hunterCfg.minSales);
        if (!alertedBefore && !already.has(h.itemId) && shouldAlert(now) && liquid) {
          toEmail.push({ ...now, searchName: searches.data.find((x) => x.id === h.searchId)?.name ?? "Search" });
          already.add(h.itemId);
          await markItemAlerted(h.itemId);
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Re-check: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (toEmail.length > 0 && emailConfigured()) {
    const best = toEmail.sort((a, b) => (b.roiPercent ?? 0) - (a.roiPercent ?? 0)).slice(0, MAX_EMAIL_ROWS);
    const appUrl = process.env.APP_URL ?? "https://www.cardhawkai.com";
    // This account's own email (admins: ALERT_EMAIL if set).
    const email = await profileEmail(await ownerId());
    const to = alertRecipient(email, isAdminEmail(email));
    if (!to) summary.errors.push("No email address on file for this account yet — open CardHawk once while signed in.");
    else {
      const err = await sendAlertEmail(
        `CardHawk: ${toEmail.length} new deal${toEmail.length === 1 ? "" : "s"}`,
        alertEmailHtml(best, displayFx(settings), appUrl),
        to,
      );
      if (err) summary.errors.push(err);
      else summary.emailed = best.length;
    }
  }

  // Phone notifications for the same alert-worthy deals as the email.
  if (toEmail.length > 0) {
    const p = await pushToAllDevices(dealsMessage(toEmail, displayFx(settings)));
    summary.pushed = p.sent;
    summary.errors.push(...p.errors);
  }

  await recordScanRun({
    trigger,
    searches: summary.searches,
    newListings: summary.newListings,
    deals: summary.deals,
    emailed: summary.emailed,
    error: summary.errors.length ? summary.errors.join("; ").slice(0, 500) : null,
  });
  return summary;
}

/** Count a shared call (made once for everyone) as "shared" usage, not this account's. */
function asShared<T>(fn: () => Promise<T>): Promise<T> {
  const store = scanContext.getStore();
  return store ? scanContext.run({ ...store, scope: "shared" }, fn) : fn();
}

/** The whole scheduled run must finish inside Vercel's 60-second limit. */
export const RUN_BUDGET_MS = 50_000;
const MIN_ACCOUNT_SLICE_MS = 12_000;

export interface ScheduledSummary extends ScanSummary {
  accounts: number;
  /** Accounts not reached this time (they go first next run). */
  skipped: number;
}

/**
 * Scheduled scans for every account (Phase 6 step 5):
 *  - Popular sets refresh once; the Profit Hunter's eBay search runs once per sport + market + delivery
 *    address for everyone, then each account's own budget, rules and exclude words are applied;
 *  - identical eBay searches and listing look-ups are made once per run;
 *  - accounts that waited longest go first; each gets a fair slice of the time left;
 *  - API calls are counted per account (and "shared") for the Admin page.
 */
export async function runScheduledScans(trigger: "schedule" | "daily" | "hunter", only?: "hunter" | "hunter-quick"): Promise<ScheduledSummary> {
  const start = Date.now();
  const deadline = start + RUN_BUDGET_MS;
  const owners = await listScanOwners();
  if (owners.error) return { ...mergeSummaries([]), errors: [`Accounts: ${owners.error}`], accounts: 0, skipped: 0 };

  const shared: ScanSummary[] = [];
  if (providerConfigured() && owners.data.length > 0) {
    const g = await runShared(() => refreshGuideSets({ deadline: start + GUIDE_TIME_BUDGET_MS, maxRequests: 3 }));
    shared.push({ ...mergeSummaries([]), guideSets: g.setsUpdated, errors: g.errors });
  }

  // Everyone's Hunter rules, grouped so each sport + market + delivery address is searched once.
  const hunterGroups = new Map<string, HunterGroup>();
  for (const uid of owners.data) {
    await runAsUser(uid, async () => {
      const [{ settings }, h] = await Promise.all([loadSettings(), loadHunterConfig()]);
      if (!h.config.enabled) return;
      for (const sport of h.config.sports) {
        const k = hunterGroupKey(sport, h.config.market, shipToFor(settings));
        const g = hunterGroups.get(k);
        hunterGroups.set(k, {
          maxBudget: Math.max(g?.maxBudget ?? 0, h.config.budget),
          minPrice: Math.min(g?.minPrice ?? Infinity, h.config.minPrice),
          auctions: (g?.auctions ?? false) || h.config.includeAuctions,
        });
      }
    });
  }

  const ebay = rememberingEbay();
  const runs: ScanSummary[] = [];
  let skipped = 0;
  for (let i = 0; i < owners.data.length; i++) {
    const left = deadline - Date.now();
    if (left < 5_000) {
      skipped = owners.data.length - i;
      break;
    }
    const slice = Math.max(MIN_ACCOUNT_SLICE_MS, left / (owners.data.length - i));
    runs.push(
      await runAsUser(owners.data[i], () =>
        runAllScans(trigger, { only, ebay, hunterGroups, deadline: Math.min(deadline, Date.now() + slice), skipGuideRefresh: true }),
      ),
    );
  }
  await recordUsage(takeUsage());
  return { ...mergeSummaries([...shared, ...runs]), accounts: owners.data.length, skipped };
}
