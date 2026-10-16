/**
 * Automatic values: look a card up in SportsCardsPro/PriceCharting once, cache the result,
 * refresh daily. Used by scans (new + recent listings), the Analyse page and the Settings test.
 */
import { cardKey } from "@/lib/cardKey";
import { PROVIDER_LABEL, buildQuery, pickProduct, priceFor, priceFieldFor, siteFor } from "@/lib/provider";
import { getProduct, providerConfigured, searchProducts } from "@/lib/provider-client";
import type { CardValue } from "@/lib/scan";
import type { CardIdentity } from "@/lib/types";
import { listProviderValues, saveProviderValue, type ProviderValueRow } from "./db";

export const REFRESH_MATCHED_MS = 24 * 3_600_000;
export const RETRY_UNMATCHED_MS = 7 * 86_400_000;

export interface LookupOutcome {
  row: Omit<ProviderValueRow, "fetchedAt">;
  error?: string; // network/token problem — nothing was saved
  code?: number;
}

/** Does this cached row still need a fresh lookup? */
export function needsLookup(row: Pick<ProviderValueRow, "status" | "fetchedAt"> | undefined, now = Date.now()): boolean {
  if (!row) return true;
  if (row.status === "rejected") return false; // you said it's wrong — never auto-value again
  const age = now - new Date(row.fetchedAt).getTime();
  return row.status === "matched" ? age > REFRESH_MATCHED_MS : age > RETRY_UNMATCHED_MS;
}

/** Look one card up in the price guide (1–2 API calls) and save the result. */
export async function lookupCard(card: CardIdentity, key: string): Promise<LookupOutcome> {
  const site = siteFor(card);
  const blank = { key, site, productId: null, matchedName: null, valueUsd: null, priceField: null, graderSpecific: true, salesVolume: null, card };
  if (!priceFieldFor(card)) {
    const row = { ...blank, status: "no_price" as const, detail: "The price guide has no separate price for this grade." };
    await saveProviderValue(row);
    return { row };
  }
  const found = await searchProducts(site, buildQuery(card));
  if (!found.ok) return { row: { ...blank, status: "no_match", detail: found.error }, error: found.error, code: found.code };

  const pick = pickProduct(card, found.data);
  if (!pick.ok) {
    const row = { ...blank, status: pick.reason, detail: pick.detail } as const;
    await saveProviderValue(row);
    return { row };
  }
  let product = pick.product;
  if (Object.keys(product.prices).length === 0) {
    // Search results without prices — fetch the full product.
    const full = await getProduct(site, product.id);
    if (!full.ok) return { row: { ...blank, status: "no_match", detail: full.error }, error: full.error, code: full.code };
    product = full.data;
  }
  const matchedName = `${product.productName} · ${product.consoleName}`;
  const price = priceFor(card, product);
  const row: Omit<ProviderValueRow, "fetchedAt"> = price
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
    : { ...blank, status: "no_price", productId: product.id, matchedName, salesVolume: product.salesVolume, detail: "Matched, but no price for this grade yet." };
  await saveProviderValue(row);
  return { row };
}

export interface FillSummary {
  looked: number;
  matched: number;
  newValues: Map<string, CardValue>;
  error: string | null;
}

/**
 * Look up as many of these cards as time allows (newest first), skipping fresh cache entries
 * and cards you've valued yourself. Stops at `deadline` (ms timestamp) or on a token/limit problem.
 */
export async function fillProviderValues(
  cards: { key: string; card: CardIdentity }[],
  mineKeys: Set<string>,
  deadline: number,
): Promise<FillSummary> {
  const out: FillSummary = { looked: 0, matched: 0, newValues: new Map(), error: null };
  if (!providerConfigured()) return out;
  const cached = await listProviderValues();
  if (cached.error && /provider_values/.test(cached.error)) {
    out.error = "run the one-time SQL update in Supabase (see PROGRESS.md) to turn them on.";
    return out;
  }
  const byKey = new Map(cached.data.map((r) => [r.key, r]));
  const seen = new Set<string>();
  for (const { key, card } of cards) {
    if (seen.has(key) || mineKeys.has(key) || !needsLookup(byKey.get(key))) continue;
    seen.add(key);
    if (Date.now() > deadline) break;
    const r = await lookupCard(card, key);
    if (r.error) {
      out.error = r.error;
      if (r.code === 429 || r.code === 401 || r.code === 403) break;
      continue;
    }
    out.looked++;
    if (r.row.status === "matched" && r.row.valueUsd !== null) {
      out.matched++;
      out.newValues.set(key, {
        id: `auto:${key}`,
        key,
        title: r.row.matchedName ?? "Price guide value",
        valueUsd: r.row.valueUsd,
        updatedAt: new Date().toISOString(),
        source: r.row.site,
        matchedName: r.row.matchedName ?? undefined,
        graderSpecific: r.row.graderSpecific,
      });
    }
  }
  return out;
}

/** Card + key for a listing title (only complete identities can be looked up). */
export function identityFromTitle(parse: (t: string) => { card: Partial<CardIdentity> }, title: string): { key: string; card: CardIdentity } | null {
  const card = parse(title).card;
  const key = cardKey(card);
  return key ? { key, card: card as CardIdentity } : null;
}

export function providerName(site: string | null | undefined): string {
  return site === "pricecharting" ? PROVIDER_LABEL.pricecharting : PROVIDER_LABEL.sportscardspro;
}
