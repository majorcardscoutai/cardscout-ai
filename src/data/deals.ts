/**
 * "Top Deals": live listings found by your scans that meet your rules RIGHT NOW,
 * re-priced with today's Card Values, Settings and exchange rate (logic in src/lib/deals.ts).
 */
import { pickDeals, type PickedDeals } from "@/lib/deals";
import type { Settings } from "@/lib/types";
import { cardValueMap, listRecentHits, listSavedSearches, loadSettings } from "./db";

export { sortDeals, type DealHit, type DealSort } from "@/lib/deals";

export interface CurrentDeals extends PickedDeals {
  settings: Settings;
  error: string | null;
}

export async function currentDeals(): Promise<CurrentDeals> {
  const [{ settings }, hits, values, searches] = await Promise.all([
    loadSettings(),
    listRecentHits(1000),
    cardValueMap(),
    listSavedSearches(),
  ]);
  return {
    settings,
    error: hits.error ?? values.error ?? null,
    ...pickDeals(hits.data, settings, values.map, searches.data),
  };
}
