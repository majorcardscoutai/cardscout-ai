import { currentDeals } from "@/data/deals";
import { lastScanRuns, listSavedSearches, listWatchlist, loadHunterConfig } from "@/data/db";
import { hunterStatus, type NavCounts } from "@/lib/nav";

/**
 * The numbers beside the menu items. Streamed in after the page (the menu never waits for them),
 * and any failure just hides the badges.
 */
export async function navCounts(): Promise<NavCounts | null> {
  try {
    const [deals, searches, watch, hunter, runs] = await Promise.all([
      currentDeals(),
      listSavedSearches(),
      listWatchlist(),
      loadHunterConfig(),
      lastScanRuns(20),
    ]);
    const hunterIds = new Set(searches.data.filter((s) => s.kind === "hunter").map((s) => s.id));
    const lastHunter = runs.data.find((r) => r.trigger === "hunter" && !r.error) ?? null;
    return {
      topDeals: deals.deals.length,
      hunterDeals: deals.deals.filter((d) => hunterIds.has(d.searchId)).length,
      savedSearches: searches.data.filter((s) => s.kind !== "hunter" && s.active).length,
      watchlist: watch.data.length,
      hunter: hunterStatus(hunter.config.enabled, lastHunter?.createdAt ?? null),
    };
  } catch {
    return null;
  }
}
