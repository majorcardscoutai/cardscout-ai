/**
 * Runs every active saved search: eBay → de-duplicate → value → score → save → email.
 * Called by the scheduled endpoint (/api/cron/scan) and the "Scan now" button.
 */
import { ebayConfigured, getListing, searchListings, type EbayListing, type Marketplace } from "@/lib/ebay/client";
import type { ShipTo } from "@/lib/region";
import { pickRechecks, recheckUpdate } from "@/lib/freshness";
import { cardKey } from "@/lib/cardKey";
import { cardFromListing } from "@/lib/ebay/parse";
import { providerConfigured } from "@/lib/provider-client";
import type { CardIdentity, Sport } from "@/lib/types";
import { fillProviderValues, identityFromTitle, isBrandOnlySet, pendingLookups, resolveSetless } from "./provider";
import { refreshGuideSets } from "./guide";
import { alertEmailHtml, emailConfigured, sendAlertEmail } from "@/lib/email";
import { parseExcludeWords } from "@/lib/exclude";
import { displayFx, shipToFor } from "@/lib/region";
import { dealsMessage, pushToAllDevices } from "./notify";
import { evaluateListing, revalueHit, shouldAlert, type ScanHit } from "@/lib/scan";
import { hunterRules, hunterSearchInput, liquidEnough, parseHunterSport } from "@/lib/hunter";
import {
  cardValueMap,
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
    const got = await Promise.all(batch.map(({ l }) => getListing(l.itemId, market, shipTo)));
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

export async function runAllScans(
  trigger: "schedule" | "manual" | "daily" | "hunter",
  opts: { only?: "hunter" } = {},
): Promise<ScanSummary> {
  const started = Date.now();
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
  if (providerConfigured()) {
    const g = await refreshGuideSets({ deadline: started + GUIDE_TIME_BUDGET_MS, maxRequests: 3 });
    summary.guideSets = g.setsUpdated;
    summary.errors.push(...g.errors);
  }

  const toEmail: (ScanHit & { searchName: string })[] = [];
  // Your own Card Values always win; automatic values fill the rest.
  const mineKeys = new Set([...values.map.values()].filter((v) => v.source === "you").map((v) => v.key));
  // A Hunter-only run has no saved searches to share time with, so it can value more cards.
  const autoDeadline = started + (opts.only === "hunter" ? HUNTER_AUTO_VALUE_TIME_BUDGET_MS : AUTO_VALUE_TIME_BUDGET_MS);
  let autoError: string | null = null;
  const sportBySearch = new Map<string, Sport>(
    searches.data.filter((x) => x.kind === "hunter" && parseHunterSport(x.query)).map((x) => [x.id, parseHunterSport(x.query)!]),
  );
  const enrichBudget = { left: ENRICH_MAX_PER_SCAN, deadline: started + ENRICH_TIME_BUDGET_MS };
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
    return opts.only !== "hunter";
  });
  for (const s of toRun) {
    summary.searches++;
    const isHunter = s.kind === "hunter";
    // The Hunter searches one sport at a time, so every listing it finds is that sport.
    const hint: { sport?: Sport } = isHunter ? { sport: parseHunterSport(s.query) ?? undefined } : {};
    const input = isHunter
      ? { ...hunterSearchInput(parseHunterSport(s.query)!, hunterCfg), shipTo: shipToFor(settings) }
      : { q: s.query, market: s.market, category: s.category, maxPrice: s.maxPrice, format: s.format, limit: 50, exclude: parseExcludeWords(s.excludeWords), shipTo: shipToFor(settings) };
    const r = await searchListings(input);
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
        const e = await enrichVague(fresh, input.market, input.shipTo, enrichBudget, hint);
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
        opts.only === "hunter" ? Promise.resolve({ data: [], error: null }) : listRecentHits(300, false, "mine"),
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
  try {
    const [recentMine, recentHunter] = await Promise.all([listRecentHits(1000, false, "mine"), listRecentHits(1000, false, "hunter")]);
    const recent = { data: [...recentMine.data, ...recentHunter.data], error: recentMine.error ?? recentHunter.error };
    if (!recent.error) {
      const marketBySearch = new Map(searches.data.map((x) => [x.id, x.kind === "hunter" ? hunterCfg.market : x.market]));
      const hunterIds = new Set(searches.data.filter((x) => x.kind === "hunter").map((x) => x.id));
      const already = new Set(toEmail.map((h) => h.itemId));
      for (const h of pickRechecks(recent.data, settings, values.map)) {
        if (Date.now() - started > (opts.only === "hunter" ? 52_000 : RECHECK_TIME_BUDGET_MS)) break;
        const r = await getListing(h.itemId, marketBySearch.get(h.searchId) ?? "EBAY_US", shipToFor(settings));
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
    const appUrl = process.env.APP_URL ?? "https://cardscout-ai.vercel.app";
    const err = await sendAlertEmail(
      `CardHawk: ${toEmail.length} new deal${toEmail.length === 1 ? "" : "s"}`,
      alertEmailHtml(best, displayFx(settings), appUrl),
    );
    if (err) summary.errors.push(err);
    else summary.emailed = best.length;
  }

  // Phone notifications for the same alert-worthy deals as the email.
  if (toEmail.length > 0) {
    const p = await pushToAllDevices(dealsMessage(toEmail));
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
