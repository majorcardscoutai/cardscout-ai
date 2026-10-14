/**
 * Pure "Top Deals" selection (no database) so it can be unit-tested.
 * Re-prices stored scan hits with today's values/settings; hides ended auctions,
 * auctions with more than a day left, and titles matching the search's exclude words.
 * The same listing found by two searches appears once.
 */
import { excludedBy, parseExcludeWords } from "./exclude";
import { auctionEnded, auctionTooEarly, revalueHit, type ScanHit } from "./scan";
import type { Settings } from "./types";

/** A saved scan result (same shape as the database row type). */
export type StoredHit = ScanHit & { id: string; createdAt: string; searchId: string; alerted: boolean };

export interface PickedDeals {
  deals: DealHit[];
  /** Valued listings that miss your rules but are priced within 15% of your max price. */
  nearMisses: DealHit[];
  valuedCount: number;
}

export type DealHit = StoredHit & { searchName: string; discountPercent: number | null };

export type DealSort = "profit" | "roi" | "newest" | "price";

export function sortDeals<T extends DealHit>(rows: T[], sort: DealSort): T[] {
  const by: Record<DealSort, (a: T, b: T) => number> = {
    profit: (a, b) => (b.netProfitUsd ?? -Infinity) - (a.netProfitUsd ?? -Infinity),
    roi: (a, b) => (b.roiPercent ?? -Infinity) - (a.roiPercent ?? -Infinity),
    newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    price: (a, b) => (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity),
  };
  return [...rows].sort(by[sort]);
}

/** Pure part — kept separate so it can be unit-tested without a database. */
export function pickDeals(
  hits: StoredHit[],
  settings: Settings,
  values: Parameters<typeof revalueHit>[2],
  searches: { id: string; name: string; excludeWords: string }[],
  now = Date.now(),
): PickedDeals {
  const meta = new Map(searches.map((s) => [s.id, { name: s.name, exclude: parseExcludeWords(s.excludeWords) }]));
  const seen = new Set<string>();
  const rows: DealHit[] = [];
  for (const raw of hits) {
    if (seen.has(raw.itemId)) continue;
    const m = meta.get(raw.searchId);
    if (auctionEnded(raw, now) || auctionTooEarly(raw, now)) continue;
    if (m && excludedBy(raw.title, m.exclude)) continue;
    seen.add(raw.itemId);
    const h = revalueHit(raw, settings, values);
    const discountPercent =
      h.maxPriceUsd !== null && h.priceUsd !== null && h.maxPriceUsd > 0
        ? Math.round(((h.maxPriceUsd - h.priceUsd) / h.maxPriceUsd) * 1000) / 10
        : null;
    rows.push({ ...h, searchName: m?.name ?? "Search", discountPercent });
  }
  const valued = rows.filter((r) => r.valueUsd !== null);
  return {
    deals: valued.filter((r) => r.meetsCriteria),
    nearMisses: valued
      .filter((r) => !r.meetsCriteria && r.discountPercent !== null && r.discountPercent >= -15)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)),
    valuedCount: valued.length,
  };
}

