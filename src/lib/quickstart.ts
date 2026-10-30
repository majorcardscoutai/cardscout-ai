/**
 * Quick start: one short form that sets up a new account in under a minute.
 *   1. Where you buy from (AU / US)            → Settings: buyer region (+ the usual tax for a first-time setup)
 *   2. What you collect (Baseball / Basketball / Pokémon)
 *   3. Budget per card + how choosy (ROI / profit minimums)
 * Then the Profit Hunter is switched on (plans with the Hunter) or one starter saved search per sport is
 * created (plans without it). Pure — tested in tests/quickstart.test.ts.
 */
import { DEFAULT_HUNTER, HUNTER_SPORTS, type HunterConfig, type HunterSport } from "./hunter";
import type { Settings } from "./types";

export const BUDGETS = [150, 500, 1500, 5000] as const; // in the buyer's own currency (A$ for AU, US$ for US)
export type Choosy = "strict" | "balanced" | "more";

export const CHOOSY: Record<Choosy, { label: string; hint: string; minRoiPercent: number; minProfitUsd: number }> = {
  strict: { label: "Only strong deals", hint: "25%+ ROI and US$40+ profit — fewer, safer finds", minRoiPercent: 25, minProfitUsd: 40 },
  balanced: { label: "Balanced", hint: "15%+ ROI and US$20+ profit — recommended", minRoiPercent: 15, minProfitUsd: 20 },
  more: { label: "Show me more", hint: "8%+ ROI and US$10+ profit — more finds, thinner margins", minRoiPercent: 8, minProfitUsd: 10 },
};

export interface QuickStart {
  region: "AU" | "US";
  sports: HunterSport[];
  /** In the buyer's currency. */
  budget: number;
  choosy: Choosy;
}

export function parseQuickStart(fd: FormData): { ok: true; value: QuickStart } | { ok: false; error: string } {
  const region = fd.get("region") === "US" ? "US" : fd.get("region") === "AU" ? "AU" : null;
  if (!region) return { ok: false, error: "Choose where you buy from." };
  const sports = HUNTER_SPORTS.filter((s) => fd.get(`s_${s}`) === "on");
  if (sports.length === 0) return { ok: false, error: "Tick at least one: Baseball, Basketball or Pokémon." };
  const budget = Number(fd.get("budget"));
  if (!(BUDGETS as readonly number[]).includes(budget)) return { ok: false, error: "Pick a budget per card." };
  const c = String(fd.get("choosy") ?? "balanced");
  const choosy: Choosy = c === "strict" || c === "more" ? c : "balanced";
  return { ok: true, value: { region, sports, budget, choosy } };
}

/** Budget in US$ (the Profit Hunter searches eBay US). AU budgets are converted at today's rate. */
export function budgetUsd(q: Pick<QuickStart, "region" | "budget">, usdToAud: number): number {
  const usd = q.region === "AU" && usdToAud > 0 ? q.budget / usdToAud : q.budget;
  return Math.max(5, Math.round(usd));
}

/** Settings after quick start. First-time setups also get the usual tax on purchases for the region. */
export function quickStartSettings(current: Settings, q: QuickStart, firstTime: boolean): Settings {
  const c = CHOOSY[q.choosy];
  return {
    ...current,
    buyerRegion: q.region,
    shipToCountry: null,
    importTaxRate: firstTime ? (q.region === "AU" ? 0.1 : 0.08) : current.importTaxRate,
    minRoiPercent: c.minRoiPercent,
    minProfitUsd: c.minProfitUsd,
  };
}

export function quickStartHunter(q: QuickStart, usdToAud: number): HunterConfig {
  const budget = budgetUsd(q, usdToAud);
  return {
    ...DEFAULT_HUNTER,
    enabled: true,
    sports: q.sports,
    budget,
    // Skip cheap commons: at least US$10, or a tenth of the budget, whichever is higher (max US$50).
    minPrice: Math.min(50, Math.max(10, Math.round(budget / 10))),
    market: "EBAY_US",
    minRoi: null, // use Settings' minimums
    minProfit: null,
  };
}

/** Starter saved searches for plans without the Hunter: graded PSA 10s for each chosen sport, under the budget. */
export function starterSearches(q: QuickStart, usdToAud: number, max: number) {
  const budget = budgetUsd(q, usdToAud);
  const by: Record<HunterSport, { name: string; query: string; category: "sportsCards" | "pokemon" }> = {
    MLB: { name: "Baseball PSA 10 rookies", query: "baseball rookie PSA 10", category: "sportsCards" },
    NBA: { name: "Basketball PSA 10 rookies", query: "basketball rookie PSA 10", category: "sportsCards" },
    Pokemon: { name: "Pokémon PSA 10", query: "pokemon PSA 10", category: "pokemon" },
  };
  return q.sports.slice(0, Math.max(0, max)).map((s) => ({
    ...by[s],
    market: "EBAY_US" as const,
    format: "FIXED_PRICE" as const,
    maxPrice: budget,
    excludeWords: DEFAULT_HUNTER.excludeWords,
    grading: "psa" as const,
  }));
}
