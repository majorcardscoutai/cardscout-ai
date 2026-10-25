/**
 * "Top Deals" and "Profit Hunter": live listings found by your scans that meet your rules RIGHT NOW,
 * re-priced with today's Card Values, Settings and exchange rate (logic in src/lib/deals.ts).
 * Profit Hunter finds only count when the card sells often enough (Hunter → sales per year).
 */
import { pickDeals, type DealHit, type PickedDeals } from "@/lib/deals";
import { hunterRules, liquidEnough, parseHunterSport, type HunterConfig } from "@/lib/hunter";
import { isFresh } from "@/lib/freshness";
import type { Settings } from "@/lib/types";
import { cardValueMap, listGuideSets, listProviderValues, listRecentHits, listSavedSearches, loadHunterConfig, loadSettings, type SavedSearch } from "./db";
import { cardKey } from "@/lib/cardKey";
import { cardFromListing } from "@/lib/ebay/parse";
import { priceFieldFor } from "@/lib/provider";

export { sortDeals, type DealHit, type DealSort } from "@/lib/deals";

export interface CurrentDeals extends PickedDeals {
  settings: Settings;
  error: string | null;
}

export async function currentDeals(): Promise<CurrentDeals> {
  const [{ settings }, mineHits, hunterHits, values, searches, hunter] = await Promise.all([
    loadSettings(),
    listRecentHits(1000, false, "mine"),
    listRecentHits(1000, false, "hunter"),
    cardValueMap(),
    listSavedSearches(),
    loadHunterConfig(),
  ]);
  const hits = { data: [...mineHits.data, ...hunterHits.data], error: mineHits.error ?? hunterHits.error };
  const hunterIds = new Set(searches.data.filter((x) => x.kind === "hunter").map((x) => x.id));
  const liquid = (d: DealHit) => liquidEnough(d.cardKey ? values.map.get(d.cardKey) : null, hunter.config.minSales);
  // Your searches use Settings' rules; Profit Hunter finds use the Hunter's own minimums (if set).
  const mine = pickDeals(hits.data.filter((h) => !hunterIds.has(h.searchId)), settings, values.map, searches.data);
  const hunted = pickDeals(hits.data.filter((h) => hunterIds.has(h.searchId)), hunterRules(settings, hunter.config), values.map, searches.data);
  const seen = new Set(mine.deals.map((d) => d.itemId));
  return {
    settings,
    error: hits.error ?? values.error ?? null,
    deals: [...mine.deals, ...hunted.deals.filter((d) => liquid(d) && !seen.has(d.itemId))],
    nearMisses: [...mine.nearMisses, ...hunted.nearMisses.filter(liquid)].sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)),
    valuedCount: mine.valuedCount + hunted.valuedCount,
  };
}

export interface HunterView {
  settings: Settings;
  /** The ROI/profit minimums the Hunter is using (its own, or Settings'). */
  rules: { minRoiPercent: number; minProfitUsd: number };
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
  /** Where the live listings drop out before getting a value. */
  coverage: HunterCoverage;
  error: string | null;
}

export interface HunterCoverage {
  total: number;
  /** Title doesn't state everything needed for an exact match (counts per missing detail). */
  unreadable: number;
  missing: [string, number][];
  /** Grade the guide has no separate price for (e.g. PSA 6.5, Authentic). */
  noGradePrice: number;
  /** Readable, but not looked up yet (next runs). */
  waiting: number;
  noMatch: number;
  ambiguous: number;
  noPrice: number;
  rejected: number;
  valued: number;
  /** Sets that appear most in listings still without a value — worth adding to Popular sets. */
  setsToAdd: { label: string; count: number; searchUrl: string }[];
  /** A few real titles per reason, so you can see the patterns. */
  examples: { unreadable: { title: string; url: string; missing: string[] }[]; noMatch: { title: string; url: string; detail: string }[] };
}

export async function hunterView(): Promise<HunterView> {
  const [{ settings }, hits, values, searches, hunter, guide, guideSets] = await Promise.all([
    loadSettings(),
    listRecentHits(1000, false, "hunter"),
    cardValueMap(),
    listSavedSearches(),
    loadHunterConfig(),
    listProviderValues(),
    listGuideSets(),
  ]);
  const mine = searches.data.filter((x) => x.kind === "hunter");
  const ids = new Set(mine.map((x) => x.id));
  const hunterHits = hits.data.filter((h) => ids.has(h.searchId));
  const picked = pickDeals(hunterHits, hunterRules(settings, hunter.config), values.map, mine);
  const liquid = (d: DealHit) => liquidEnough(d.cardKey ? values.map.get(d.cardKey) : null, hunter.config.minSales);
  const live = hunterHits.filter((h) => isFresh(h));
  // Coverage: one row per distinct live listing.
  const rowByKey = new Map(guide.data.map((r) => [r.key, r]));
  const sportBySearch = new Map(mine.map((x) => [x.id, parseHunterSport(x.query) ?? undefined]));
  const cov: HunterCoverage = {
    total: 0, unreadable: 0, missing: [], noGradePrice: 0, waiting: 0, noMatch: 0, ambiguous: 0, noPrice: 0, rejected: 0, valued: 0,
    examples: { unreadable: [], noMatch: [] },
    setsToAdd: [],
  };
  const setCounts = new Map<string, { label: string; count: number; sport?: string; q: string }>();
  const countSet = (card: { sport?: string; year?: number; set?: string }) => {
    if (!card.set || !card.sport) return;
    const set = card.set.replace(/^\s*(19|20)\d\d(-\d\d)?\s+/, "");
    const yr = card.sport === "Pokemon" ? "" : card.year ? `${card.year} ` : "";
    const label = `${yr}${set}${card.sport === "Pokemon" ? " (Pokémon)" : card.sport === "NBA" ? " (Basketball)" : " (Baseball)"}`;
    const k = label.toLowerCase();
    const cur = setCounts.get(k) ?? { label, count: 0, sport: card.sport, q: `${yr}${set}` };
    cur.count++;
    setCounts.set(k, cur);
  };
  const missingCount = new Map<string, number>();
  const seenItems = new Set<string>();
  for (const h of live) {
    if (seenItems.has(h.itemId)) continue;
    seenItems.add(h.itemId);
    cov.total++;
    const parsed = cardFromListing(h.title, [], { sport: sportBySearch.get(h.searchId) });
    // The scan may have identified the card from eBay item specifics even when the title is vague.
    const titleKey = cardKey(parsed.card);
    const key = titleKey ?? h.cardKey;
    if (!key) {
      cov.unreadable++;
      for (const m of parsed.missing) missingCount.set(m, (missingCount.get(m) ?? 0) + 1);
      if (cov.examples.unreadable.length < 10) cov.examples.unreadable.push({ title: h.title, url: h.url, missing: parsed.missing });
      continue;
    }
    if (values.map.has(key)) { cov.valued++; continue; }
    if (titleKey) countSet(parsed.card);
    if (titleKey && !priceFieldFor(parsed.card)) { cov.noGradePrice++; continue; }
    const row = rowByKey.get(key);
    const st = row?.status;
    if (!st) cov.waiting++;
    else if (st === "no_match") {
      cov.noMatch++;
      if (cov.examples.noMatch.length < 10) cov.examples.noMatch.push({ title: h.title, url: h.url, detail: row?.detail ?? "" });
    }
    else if (st === "ambiguous") cov.ambiguous++;
    else if (st === "no_price") cov.noPrice++;
    else if (st === "rejected") cov.rejected++;
    else cov.waiting++;
  }
  cov.missing = [...missingCount.entries()].sort((a, b) => b[1] - a[1]);
  // Sets you already download don't need adding.
  const have = guideSets.data.map((g) => (g.name ?? "").toLowerCase());
  cov.setsToAdd = [...setCounts.values()]
    .filter((x) => !have.some((h) => h.includes(x.q.toLowerCase())))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((x) => ({
      label: x.label,
      count: x.count,
      searchUrl: `${x.sport === "Pokemon" ? "https://www.pricecharting.com" : "https://www.sportscardspro.com"}/search-products?${new URLSearchParams({ q: x.q, type: "prices" })}`,
    }));
  const rules = hunterRules(settings, hunter.config);
  return {
    settings,
    rules: { minRoiPercent: rules.minRoiPercent, minProfitUsd: rules.minProfitUsd },
    config: hunter.config,
    saved: hunter.saved,
    configError: hunter.error,
    searches: mine,
    deals: picked.deals.filter(liquid),
    nearMisses: picked.nearMisses.filter(liquid),
    slowSellers: picked.deals.filter((d) => !liquid(d)),
    checked: new Set(live.map((h) => h.itemId)).size,
    valued: picked.valuedCount,
    coverage: cov,
    error: hits.error ?? values.error ?? searches.error ?? null,
  };
}
