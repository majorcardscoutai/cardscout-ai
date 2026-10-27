/**
 * Automatic values: look a card up in SportsCardsPro/PriceCharting once, cache the result,
 * refresh daily. Used by scans (new + recent listings), the Analyse page and the Settings test.
 */
import { cardKey } from "@/lib/cardKey";
import { PROVIDER_LABEL, buildQuery, matchBySetInTitle, normNumber, pickProduct, priceFor, priceFieldFor, sameCardKey, siteFor, type ProviderProduct } from "@/lib/provider";
export { sameCardKey };
import { cardFromListing, type Aspect } from "@/lib/ebay/parse";
import { getProduct, providerConfigured, searchProducts } from "@/lib/provider-client";
import type { CardValue } from "@/lib/scan";
import type { CardIdentity } from "@/lib/types";
import { listProviderValues, queueProviderLookups, saveProviderValue, type ProviderValueRow } from "./db";
import { localGuide } from "./guide";

export const REFRESH_MATCHED_MS = 24 * 3_600_000;
export const RETRY_UNMATCHED_MS = 7 * 86_400_000;
/** Matching rules last improved — unmatched results saved before this are retried once. */
/** 27 Oct 2026: gallery numbers (GG54/GG70) and leading zeros (015 = 15) — unmatched lookups are retried. */
export const MATCHER_UPDATED_AT = Date.parse("2026-10-27T04:40:00Z");
/** Variation / stamped rule (23 Oct 2026): every saved guide match from before it is looked up again, matched ones too. */
export const REMATCH_ALL_AT = Date.parse("2026-10-23T03:00:00Z");
/** Parallels must now match exactly ("Refractor" ≠ "Gold Refractor"): parallel values saved before this are redone. */
export const PARALLEL_RULE_AT = Date.parse("2026-10-16T03:00:00Z");

export function staleParallel(row: { card: { parallel?: string | null } | null; fetchedAt: string }): boolean {
  return !!row.card?.parallel && new Date(row.fetchedAt).getTime() < PARALLEL_RULE_AT;
}

export interface LookupOutcome {
  row: Omit<ProviderValueRow, "fetchedAt">;
  /** The guide card it matched (with every grade's price), or why it couldn't pick one. */
  product?: ProviderProduct;
  pickFailed?: { reason: "no_match" | "ambiguous"; detail: string };
  error?: string; // network/token problem — nothing was saved
  code?: number;
}

/** Does this cached row still need a fresh lookup? */
export function needsLookup(row: Pick<ProviderValueRow, "status" | "fetchedAt"> | undefined, now = Date.now()): boolean {
  if (!row) return true;
  if (row.status === "rejected") return false; // you said it's wrong — never auto-value again
  if (row.status === "pending") return true; // queued last time — look it up now
  const fetched = new Date(row.fetchedAt).getTime();
  if (row.status !== "matched" && fetched < MATCHER_UPDATED_AT) return true;
  if (fetched < REMATCH_ALL_AT) return true;
  if ("card" in row && staleParallel(row as { card: { parallel?: string | null } | null; fetchedAt: string })) return true;
  const age = now - fetched;
  return row.status === "matched" ? age > REFRESH_MATCHED_MS : age > RETRY_UNMATCHED_MS;
}

/** Look one card up in the price guide (1–2 API calls) and save the result. */
export async function lookupCard(card: CardIdentity, key: string): Promise<LookupOutcome> {
  const site = siteFor(card);
  const blank = { key, site, productId: null, matchedName: null, valueUsd: null, priceField: null, graderSpecific: true, salesVolume: null, card };
  if (!priceFieldFor(card)) {
    const row = { ...blank, status: "no_price" as const, detail: `The price guide has no separate ${gradeLabel(card)} price.` };
    await saveProviderValue(row);
    return { row };
  }
  const found = await searchProducts(site, buildQuery(card));
  if (!found.ok) return { row: { ...blank, status: "no_match", detail: found.error }, error: found.error, code: found.code };

  const pick = pickProduct(card, found.data);
  if (!pick.ok) {
    const row = { ...blank, status: pick.reason, detail: pick.detail } as const;
    await saveProviderValue(row);
    return { row, pickFailed: { reason: pick.reason, detail: pick.detail } };
  }
  let product = pick.product;
  if (Object.keys(product.prices).length === 0) {
    // Search results without prices — fetch the full product.
    const full = await getProduct(site, product.id);
    if (!full.ok) return { row: { ...blank, status: "no_match", detail: full.error }, error: full.error, code: full.code };
    product = full.data;
  }
  const row = rowFromProduct(card, key, product);
  await saveProviderValue(row);
  return { row, product };
}

/** The cache row for a card, priced from a guide product we already have (no API call). */
export function rowFromProduct(card: CardIdentity, key: string, product: ProviderProduct): Omit<ProviderValueRow, "fetchedAt"> {
  const site = siteFor(card);
  const blank = { key, site, productId: null, matchedName: null, valueUsd: null, priceField: null, graderSpecific: true, salesVolume: null, card };
  const matchedName = `${product.productName} · ${product.consoleName}`;
  const price = priceFor(card, product);
  return price
    ? {
        ...blank,
        status: "matched",
        productId: product.id,
        matchedName,
        valueUsd: price.usd,
        priceField: price.field,
        graderSpecific: price.graderSpecific,
        salesVolume: product.salesVolume,
        detail: null,
      }
    : { ...blank, status: "no_price", productId: product.id, matchedName, salesVolume: product.salesVolume, detail: `Matched ${matchedName}, but the guide has no ${gradeLabel(card)} price for it yet.` };
}



export interface FillSummary {
  /** Valued from your downloaded Popular sets (no lookup needed). */
  local: number;
  looked: number;
  matched: number;
  newValues: Map<string, CardValue>;
  error: string | null;
  /** Cards not reached this time (time budget) — they're looked up next time. */
  pending: number;
}

/**
 * Look up as many of these cards as time allows (newest first), skipping fresh cache entries
 * and cards you've valued yourself. Stops at `deadline` (ms timestamp) or on a token/limit problem.
 */
export async function fillProviderValues(
  cards: { key: string; card: CardIdentity }[],
  mineKeys: Set<string>,
  deadlineAt: number,
): Promise<FillSummary> {
  const out: FillSummary = { local: 0, looked: 0, matched: 0, newValues: new Map(), error: null, pending: 0 };
  if (!providerConfigured()) return out;
  const cached = await listProviderValues();
  if (cached.error && /provider_values/.test(cached.error)) {
    out.error = "run the one-time SQL update in Supabase (see PROGRESS.md) to turn them on.";
    return out;
  }
  let deadline = deadlineAt;
  const byKey = new Map(cached.data.map((r) => [r.key, r]));
  const queue: { key: string; card: CardIdentity; site: string }[] = [];

  // Unique cards that need a lookup, grouped as "same card, any grade" — one lookup prices the whole group.
  // Groups seen in the most listings go first (most chances of a deal).
  const groups = new Map<string, { members: Map<string, CardIdentity>; hits: number; order: number }>();
  for (const { key, card } of cards) {
    if (mineKeys.has(key) || !needsLookup(byKey.get(key))) continue;
    const g = sameCardKey(key);
    const grp = groups.get(g) ?? { members: new Map(), hits: 0, order: groups.size };
    grp.members.set(key, card);
    grp.hits++;
    groups.set(g, grp);
  }
  const ordered = [...groups.values()].sort((a, b) => b.hits - a.hits || a.order - b.order);

  const record = (key: string, row: Omit<ProviderValueRow, "fetchedAt">) => {
    out.looked++;
    if (row.status === "matched" && row.valueUsd !== null) {
      out.matched++;
      out.newValues.set(key, {
        id: `auto:${key}`,
        key,
        title: row.matchedName ?? "Price guide value",
        valueUsd: row.valueUsd,
        updatedAt: new Date().toISOString(),
        source: row.site,
        matchedName: row.matchedName ?? undefined,
        graderSpecific: row.graderSpecific,
        salesVolume: row.salesVolume,
      });
    }
  };

  // Your Popular sets (downloaded daily) are checked first — instant, no lookup, same exact-match rules.
  const local = await localGuide(ordered.flatMap((g) => [...g.members.values()].map((c) => normNumber(c.cardNumber))));

  for (const grp of ordered) {
    const members = [...grp.members.entries()];
    const firstCard = members[0][1];
    const candidates = local.get(normNumber(firstCard.cardNumber)) ?? [];
    if (candidates.length > 0) {
      const pick = pickProduct(firstCard, candidates);
      if (pick.ok) {
        for (const [key, card] of members) {
          const row = { ...rowFromProduct(card, key, pick.product), detail: "From your Popular sets download" };
          await saveProviderValue(row);
          record(key, row);
        }
        out.local += members.length;
        continue;
      }
    }
    if (Date.now() > deadline) {
      for (const [key, card] of members) {
        out.pending++;
        if (!byKey.has(key) && priceFieldFor(card)) queue.push({ key, card, site: siteFor(card) });
      }
      continue;
    }
    // Look up one grade that has a price field; price the others from the same guide card.
    const lead = members.find(([, c]) => priceFieldFor(c)) ?? members[0];
    const r = await lookupCard(lead[1], lead[0]);
    if (r.error) {
      out.error = r.error;
      if (r.code === 429 || r.code === 401 || r.code === 403) deadline = 0; // stop looking up, just count the rest
      continue;
    }
    record(lead[0], r.row);
    for (const [key, card] of members) {
      if (key === lead[0]) continue;
      let row: Omit<ProviderValueRow, "fetchedAt">;
      if (r.product) row = rowFromProduct(card, key, r.product);
      else if (r.pickFailed) row = { ...r.row, key, card, status: r.pickFailed.reason, detail: r.pickFailed.detail };
      else {
        // The lead had no price field (e.g. an odd grade) — look this one up on its own.
        const own = await lookupCard(card, key);
        if (own.error) continue;
        record(key, own.row);
        continue;
      }
      await saveProviderValue(row);
      record(key, row);
    }
  }
  // Remember cards we ran out of time for, so the next scan looks them up first
  // (works even when the card was read from eBay item specifics, not the title).
  if (queue.length > 0) await queueProviderLookups(queue.slice(0, 300));
  return out;
}

/** Cards queued by earlier scans, oldest first. */
export async function pendingLookups(): Promise<{ key: string; card: CardIdentity }[]> {
  const rows = await listProviderValues();
  return rows.data
    .filter((r) => r.status === "pending" && r.card)
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
    .map((r) => ({ key: r.key, card: r.card as CardIdentity }));
}

/** Card + key for a listing title (only complete identities can be looked up). */
export function identityFromTitle(
  parse: (t: string, aspects?: [], hint?: { sport?: CardIdentity["sport"] }) => { card: Partial<CardIdentity> },
  title: string,
  hint: { sport?: CardIdentity["sport"] } = {},
): { key: string; card: CardIdentity } | null {
  const card = parse(title, [], hint).card;
  const key = cardKey(card);
  return key ? { key, card: card as CardIdentity } : null;
}

export function providerName(site: string | null | undefined): string {
  return site === "pricecharting" ? PROVIDER_LABEL.pricecharting : PROVIDER_LABEL.sportscardspro;
}

function gradeLabel(card: CardIdentity): string {
  if (card.grader === "RAW" || card.grade === null || card.grade === undefined) return "ungraded";
  return `${card.grader ?? ""} ${card.grade}`.trim();
}

// ---------- Set-name fallback ----------

const BRAND_ONLY = /^(topps|bowman|donruss|upper deck|fleer)$/i;
/** A set read as just a brand ("Topps") — the Hunter confirms the real set from the guide instead. */
export function isBrandOnlySet(set: string | null | undefined): boolean {
  return BRAND_ONLY.test(set ?? "");
}

/** Guide search results for one player + year + number, cached a week (status "setlist"). */
const SETLIST_TTL_MS = 7 * 86_400_000;

export interface SetlessResult<T> {
  items: T[];
  newValues: Map<string, CardValue>;
  /** Searches made, listings identified this way. */
  searched: number;
  identified: number;
}

/**
 * Listings whose title has the player, year, card number and grade but a set we don't recognise:
 * search the guide by player + year + number and accept the card whose own player AND set names are
 * both in the title. The identified set + player are added as item specifics, so the rest of the app
 * (keys, profit, alerts, re-checks) treats the listing like any other.
 */
export async function resolveSetless<T extends { title: string; aspects: Aspect[] }>(
  items: T[],
  hint: { sport?: CardIdentity["sport"] },
  mineKeys: Set<string>,
  deadline: number,
): Promise<SetlessResult<T>> {
  const out: SetlessResult<T> = { items: [...items], newValues: new Map(), searched: 0, identified: 0 };
  if (!providerConfigured()) return out;
  const todo = out.items
    .map((l, i) => ({ l, i, parsed: cardFromListing(l.title, l.aspects, hint) }))
    .filter(({ parsed }) => {
      if (priceFieldFor(parsed.card) === null) return false;
      if (parsed.missing.length === 1 && parsed.missing[0] === "set") return true;
      // Only a brand was read ("Topps"), which may really be "Topps Lineage" etc. — let the guide confirm it.
      return parsed.missing.length === 0 && parsed.sources.set === "title" && BRAND_ONLY.test(parsed.card.set ?? "");
    });
  if (todo.length === 0) return out;
  const cached = await listProviderValues();
  if (cached.error) return out;
  const byKey = new Map(cached.data.map((r) => [r.key, r]));
  const lists = new Map<string, ProviderProduct[] | null>();
  const valued = (k: string | null) => !!k && byKey.get(k)?.status === "matched";
  for (const { l, i, parsed } of todo) {
    const card = parsed.card as CardIdentity;
    if (valued(cardKey(card))) continue; // brand-only reading already matched the guide
    const site = siteFor(card);
    const qKey = ["setq", card.sport, (card.player ?? "").toLowerCase(), card.year ?? "", normNumber(card.cardNumber)].join("|");
    // Popular sets first: if the card is in a set you download, no search is needed.
    const localCands = (await localGuide([normNumber(card.cardNumber)])).get(normNumber(card.cardNumber)) ?? [];
    const localMatch = localCands.length > 0 ? matchBySetInTitle(card, l.title, localCands) : null;
    let products = localMatch?.ok ? localCands : lists.get(qKey);
    if (products === undefined) {
      const row = byKey.get(qKey);
      const fresh = row && row.status === "setlist" && Date.now() - new Date(row.fetchedAt).getTime() < SETLIST_TTL_MS;
      if (fresh) products = ((row!.card as unknown as { products?: ProviderProduct[] })?.products ?? []) as ProviderProduct[];
      else if (Date.now() < deadline) {
        const found = await searchProducts(site, buildQuery({ ...card, set: undefined, parallel: undefined }));
        out.searched++;
        if (!found.ok) {
          if (found.code === 429 || found.code === 401 || found.code === 403) break;
          products = null;
        } else {
          products = found.data;
          await saveProviderValue({
            key: qKey, status: "setlist", site, productId: null, matchedName: null, valueUsd: null, priceField: null,
            graderSpecific: true, salesVolume: null, detail: null,
            card: { products } as unknown as CardIdentity,
          });
        }
      } else products = null; // out of time — next run
      lists.set(qKey, products);
    }
    if (!products || products.length === 0) continue;
    const m = matchBySetInTitle(card, l.title, products);
    if (!m.ok) continue;
    // Add what the guide confirmed as item specifics, then key + value it like any listing.
    const aspects: Aspect[] = [...l.aspects.filter((a) => !/^(set|player\/athlete)$/i.test(a.name)), { name: "Set", value: m.set }, { name: "Player/Athlete", value: m.player }];
    out.items[i] = { ...l, aspects };
    const full = cardFromListing(l.title, aspects, hint).card;
    const key = cardKey(full);
    if (!key) continue;
    out.identified++;
    if (mineKeys.has(key) || !needsLookup(byKey.get(key))) continue;
    let product = m.product;
    if (Object.keys(product.prices).length === 0) {
      if (Date.now() > deadline) continue;
      const got = await getProduct(site, product.id);
      if (!got.ok) continue;
      product = got.data;
    }
    const row = rowFromProduct(full as CardIdentity, key, product);
    await saveProviderValue(row);
    byKey.set(key, { ...row, fetchedAt: new Date().toISOString() });
    if (row.status === "matched" && row.valueUsd !== null)
      out.newValues.set(key, {
        id: `auto:${key}`, key, title: row.matchedName ?? "Price guide value", valueUsd: row.valueUsd,
        updatedAt: new Date().toISOString(), source: row.site, matchedName: row.matchedName ?? undefined,
        graderSpecific: row.graderSpecific, salesVolume: row.salesVolume,
      });
  }
  return out;
}
