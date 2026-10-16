/**
 * "Top Deals" and "Profit Hunter": live listings found by your scans that meet your rules RIGHT NOW,
 * re-priced with today's Card Values, Settings and exchange rate (logic in src/lib/deals.ts).
 * Profit Hunter finds only count when the card sells often enough (Hunter → sales per year).
 */
import { pickDeals, type DealHit, type PickedDeals } from "@/lib/deals";
import { liquidEnough, type HunterConfig } from "@/lib/hunter";
import { isFresh } from "@/lib/freshness";
import type { Settings } from "@/lib/types";
import { cardValueMap, listRecentHits, listSavedSearches, loadHunterConfig, loadSettings, type SavedSearch } from "./db";

export { sortDeals, type DealHit, type DealSort } from "@/lib/deals";

export interface CurrentDeals extends PickedDeals {
  settings: Settings;
  error: string | null;
}

export async function currentDeals(): Promise<CurrentDeals> {
  const [{ settings }, hits, values, searches, hunter] = await Promise.all([
    loadSettings(),
    listRecentHits(1000),
    cardValueMap(),
    listSavedSearches(),
    loadHunterConfig(),
  ]);
  const hunterIds = new Set(searches.data.filter((x) => x.kind === "hunter").map((x) => x.id));
  const ok = (d: DealHit) => !hunterIds.has(d.searchId) || liquidEnough(d.cardKey ? values.map.get(d.cardKey) : null, hunter.config.minSales);
  const picked = pickDeals(hits.data, settings, values.map, searches.data);
  return {
    settings,
    error: hits.error ?? values.error ?? null,
    ...picked,
    deals: picked.deals.filter(ok),
    nearMisses: picked.nearMisses.filter(ok),
  };
}

export interface HunterView {
  settings: Settings;
  config: HunterConfig;
  /** false until you've saved the Hunter once (or the SQL hasn't been run). */
  saved: boolean;
  configError: string | null;
  searches: SavedSearch[];
  deals: DealHit[];
  nearMisses: DealHit[];
  /** Profitable, but the card sells less often than your minimum. */
  slowSellers: DealHit[];
  /** Hunter listings still live (under 6 hours old) and how many have a value. */
  checked: number;
  valued: number;
  error: string | null;
}

export async function hunterView(): Promise<HunterView> {
  const [{ settings }, hits, values, searches, hunter] = await Promise.all([
    loadSettings(),
    listRecentHits(1000),
    cardValueMap(),
    listSavedSearches(),
    loadHunterConfig(),
  ]);
  const mine = searches.data.filter((x) => x.kind === "hunter");
  const ids = new Set(mine.map((x) => x.id));
  const hunterHits = hits.data.filter((h) => ids.has(h.searchId));
  const picked = pickDeals(hunterHits, settings, values.map, mine);
  const liquid = (d: DealHit) => liquidEnough(d.cardKey ? values.map.get(d.cardKey) : null, hunter.config.minSales);
  const live = hunterHits.filter((h) => isFresh(h));
  return {
    settings,
    config: hunter.config,
    saved: hunter.saved,
    configError: hunter.error,
    searches: mine,
    deals: picked.deals.filter(liquid),
    nearMisses: picked.nearMisses.filter(liquid),
    slowSellers: picked.deals.filter((d) => !liquid(d)),
    checked: new Set(live.map((h) => h.itemId)).size,
    valued: picked.valuedCount,
    error: hits.error ?? values.error ?? searches.error ?? null,
  };
}
