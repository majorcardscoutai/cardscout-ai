/**
 * Data access layer.
 * Pages call these functions instead of touching data files directly.
 *
 * - Settings, watchlist and portfolio: your real data in Supabase (Phase 2).
 * - Listings and sold comparisons: still DEMONSTRATION data until Phase 3
 *   connects authorised sources (eBay Browse API, PriceCharting, PSA).
 */
import { analyseListing, type Assessment } from "@/lib/analysis";
import type { Settings } from "@/lib/types";
import { DEMO_AS_OF, DEMO_COMPS, DEMO_LISTINGS, DEMO_SAVED_SEARCHES } from "./demo";
import { loadSettings } from "./db";

export const DATA_MODE = "demo" as const;

export async function getSettings(): Promise<Settings> {
  return (await loadSettings()).settings;
}

export { loadSettings, listHoldings, listWatchlist } from "./db";

export function getAssessments(settings: Settings): Assessment[] {
  return DEMO_LISTINGS.map((listing) =>
    analyseListing(listing, DEMO_COMPS[listing.id] ?? [], null, settings, DEMO_AS_OF),
  ).sort((a, b) => (b.score.total ?? -1) - (a.score.total ?? -1));
}

export function getAssessment(id: string, settings: Settings): Assessment | null {
  return getAssessments(settings).find((a) => a.listing.id === id) ?? null;
}

export function getSavedSearches() {
  return DEMO_SAVED_SEARCHES;
}

export function getAsOf(): Date {
  return DEMO_AS_OF;
}
