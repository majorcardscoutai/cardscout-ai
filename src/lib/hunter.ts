/**
 * Profit Hunter — pure logic (no network/database).
 *
 * Instead of one card at a time, the Hunter searches EVERY new graded listing in a sport
 * under your budget, values each card from the price guide, and flags anything that clears
 * your ROI/profit rules AND sells often enough to flip (sales per year from the guide).
 *
 * Each chosen sport is stored as a hidden saved search (kind = "hunter", query = sport code),
 * so scans, freshness re-checks, alerts and "Wrong match?" all work exactly like saved searches.
 */
import type { SearchInput } from "./ebay/client";
import { parseExcludeWords, excludeWordsText } from "./exclude";
import type { CardValue } from "./scan";

export type HunterSport = "MLB" | "NBA" | "Pokemon";
export const HUNTER_SPORTS: HunterSport[] = ["MLB", "NBA", "Pokemon"];
export const HUNTER_SPORT_LABEL: Record<HunterSport, string> = { MLB: "Baseball", NBA: "Basketball", Pokemon: "Pokémon" };

export interface HunterConfig {
  enabled: boolean;
  /** Max price per listing, in the eBay site's currency. */
  budget: number;
  minPrice: number;
  sports: HunterSport[];
  includeAuctions: boolean;
  /** Skip cards that sell fewer times a year than this (hard to resell). 0 = no limit. */
  minSales: number;
  excludeWords: string;
  market: "EBAY_US" | "EBAY_AU";
}

export const DEFAULT_HUNTER: HunterConfig = {
  enabled: false,
  budget: 300,
  minPrice: 20,
  sports: ["MLB", "NBA", "Pokemon"],
  includeAuctions: false,
  minSales: 12,
  excludeWords: "lot, reprint, custom, digital, proxy, break",
  market: "EBAY_US",
};

/** Listings per search per run (eBay's maximum page size). */
export const HUNTER_PAGE_SIZE = 200;

export function hunterSearchName(sport: HunterSport): string {
  return `Profit Hunter · ${HUNTER_SPORT_LABEL[sport]}`;
}

export function parseHunterSport(q: string): HunterSport | null {
  return (HUNTER_SPORTS as string[]).includes(q) ? (q as HunterSport) : null;
}

/** The eBay search for one sport: graded cards, newest first, inside your price range. */
export function hunterSearchInput(sport: HunterSport, c: HunterConfig): SearchInput {
  const graders = "(PSA, BGS, SGC, CGC)";
  return {
    // eBay: words in brackets separated by commas = any of them.
    q: sport === "Pokemon" ? `pokemon ${graders}` : graders,
    market: c.market,
    category: sport === "Pokemon" ? "pokemon" : "sportsCards",
    aspectFilter: sport === "Pokemon" ? undefined : `Sport:{${sport === "MLB" ? "Baseball" : "Basketball"}}`,
    maxPrice: c.budget,
    minPrice: c.minPrice > 0 ? c.minPrice : null,
    format: c.includeAuctions ? "ALL" : "FIXED_PRICE",
    limit: HUNTER_PAGE_SIZE,
    exclude: parseExcludeWords(c.excludeWords),
  };
}

/** Does this value come with enough sales to resell? Your own values always pass. */
export function liquidEnough(v: Pick<CardValue, "source" | "salesVolume"> | null | undefined, minSales: number): boolean {
  if (!v) return false;
  if ((v.source ?? "you") === "you" || minSales <= 0) return true;
  return (v.salesVolume ?? 0) >= minSales;
}

export type HunterFormResult = { ok: true; value: HunterConfig } | { ok: false; error: string };

export function parseHunterForm(fd: FormData): HunterFormResult {
  const num = (k: string) => {
    const raw = String(fd.get(k) ?? "").replace(/[,\s$]/g, "");
    return raw === "" ? NaN : Number(raw);
  };
  const budget = num("budget");
  if (!Number.isFinite(budget) || budget < 5 || budget > 100_000) return { ok: false, error: "Budget must be a number between 5 and 100,000." };
  let minPrice = num("minPrice");
  if (Number.isNaN(minPrice)) minPrice = 0;
  if (!Number.isFinite(minPrice) || minPrice < 0) return { ok: false, error: "Minimum price must be 0 or more." };
  if (minPrice >= budget) return { ok: false, error: "Minimum price must be lower than your budget." };
  let minSales = num("minSales");
  if (Number.isNaN(minSales)) minSales = 0;
  if (!Number.isInteger(minSales) || minSales < 0 || minSales > 10_000) return { ok: false, error: "Sales per year must be a whole number (0 = no limit)." };
  const sports = HUNTER_SPORTS.filter((s) => fd.get(`s_${s}`) === "on");
  const enabled = fd.get("enabled") === "on";
  if (enabled && sports.length === 0) return { ok: false, error: "Tick at least one of Baseball, Basketball or Pokémon." };
  return {
    ok: true,
    value: {
      enabled,
      budget: Math.round(budget * 100) / 100,
      minPrice: Math.round(minPrice * 100) / 100,
      sports,
      includeAuctions: fd.get("auctions") === "on",
      minSales,
      excludeWords: excludeWordsText(parseExcludeWords(String(fd.get("x") ?? ""))),
      market: fd.get("market") === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
    },
  };
}
