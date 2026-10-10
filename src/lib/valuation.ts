import { roundMoney } from "./currency";
import type { Confidence, SoldComp } from "./types";

/**
 * Valuation engine — estimates market value from SOLD comparisons only.
 * Asking prices are never used as evidence of value.
 *
 * Method:
 * 1. Prefer exact-card comps (same set, number, parallel, grader, grade).
 *    Fall back to "close" comps only when there are too few exact ones,
 *    and lower the confidence when we do.
 * 2. Ignore sales older than the look-back window.
 * 3. Remove outliers (outside 1.5 × the interquartile range).
 * 4. Take a weighted median. Weights favour recent sales (45-day half-life)
 *    and down-weight Best Offer sales (eBay shows the list price, not the
 *    accepted price, so the true price is uncertain).
 * 5. Rate confidence from comp count, recency and price spread.
 * If there isn't enough evidence, return value = null and say why.
 */

export const LOOKBACK_DAYS = 120;
export const HALF_LIFE_DAYS = 45;
const MIN_EXACT_COMPS = 3;
const MIN_ANY_COMPS = 3;

export interface ValuationResult {
  estimatedValueUsd: number | null;
  confidence: Confidence;
  compsUsed: SoldComp[];
  compsExcluded: { comp: SoldComp; reason: string }[];
  basis: "exact" | "close" | "insufficient";
  lowUsd: number | null;
  highUsd: number | null;
  spreadPercent: number | null; // coefficient of variation of used comps
  salesLast90Days: number; // exact-match sales, used for liquidity
  notes: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(fromIso: string, to: Date): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function weightedMedian(values: { value: number; weight: number }[]): number {
  if (values.length === 0) throw new Error("weightedMedian needs at least one value");
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, v) => s + v.weight, 0);
  let running = 0;
  for (const v of sorted) {
    running += v.weight;
    if (running >= total / 2) return v.value;
  }
  return sorted[sorted.length - 1].value;
}

function compWeight(comp: SoldComp, asOf: Date): number {
  const age = daysBetween(comp.soldDate, asOf);
  const recency = Math.pow(0.5, age / HALF_LIFE_DAYS);
  const saleTypeFactor = comp.saleType === "BEST_OFFER_ACCEPTED" ? 0.5 : 1;
  return recency * saleTypeFactor;
}

export function estimateMarketValue(comps: SoldComp[], asOf: Date): ValuationResult {
  const excluded: { comp: SoldComp; reason: string }[] = [];
  const notes: string[] = [];

  const recent = comps.filter((c) => {
    const age = daysBetween(c.soldDate, asOf);
    if (age > LOOKBACK_DAYS) {
      excluded.push({ comp: c, reason: `Older than ${LOOKBACK_DAYS} days` });
      return false;
    }
    if (!(c.soldPriceUsd > 0)) {
      excluded.push({ comp: c, reason: "Missing or invalid sold price" });
      return false;
    }
    return true;
  });

  const exact = recent.filter((c) => c.match === "exact");
  const close = recent.filter((c) => c.match === "close");
  const salesLast90Days = exact.filter((c) => daysBetween(c.soldDate, asOf) <= 90).length;

  let pool: SoldComp[];
  let basis: ValuationResult["basis"];
  if (exact.length >= MIN_EXACT_COMPS) {
    pool = exact;
    basis = "exact";
    close.forEach((c) =>
      excluded.push({ comp: c, reason: "Not an exact match (enough exact comps available)" }),
    );
  } else if (exact.length + close.length >= MIN_ANY_COMPS) {
    pool = [...exact, ...close];
    basis = "close";
    notes.push(
      `Only ${exact.length} exact-match sale(s); close matches were included, so treat this value with caution.`,
    );
  } else {
    return {
      estimatedValueUsd: null,
      confidence: "none",
      compsUsed: [],
      compsExcluded: [
        ...excluded,
        ...recent.map((c) => ({ comp: c, reason: "Too few comparable sales to value" })),
      ],
      basis: "insufficient",
      lowUsd: null,
      highUsd: null,
      spreadPercent: null,
      salesLast90Days,
      notes: [
        `Only ${recent.length} usable sold comparison(s) in the last ${LOOKBACK_DAYS} days. Not enough evidence to estimate a market value.`,
      ],
    };
  }

  // Outlier removal (only meaningful with 4+ points).
  if (pool.length >= 4) {
    const prices = pool.map((c) => c.soldPriceUsd).sort((a, b) => a - b);
    const q1 = quantile(prices, 0.25);
    const q3 = quantile(prices, 0.75);
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    pool = pool.filter((c) => {
      if (c.soldPriceUsd < lo || c.soldPriceUsd > hi) {
        excluded.push({ comp: c, reason: "Price outlier (outside 1.5 × IQR)" });
        return false;
      }
      return true;
    });
  }

  const estimate = weightedMedian(
    pool.map((c) => ({ value: c.soldPriceUsd, weight: compWeight(c, asOf) })),
  );

  const prices = pool.map((c) => c.soldPriceUsd);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  const sd = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length);
  const spreadPercent = mean > 0 ? roundMoney((sd / mean) * 100) : null;
  const newestAge = Math.min(...pool.map((c) => daysBetween(c.soldDate, asOf)));

  // Confidence rules — simple and visible.
  let confidence: Confidence;
  if (basis === "exact" && pool.length >= 5 && (spreadPercent ?? 100) <= 20 && newestAge <= 30) {
    confidence = "high";
  } else if (basis === "exact" && pool.length >= 3 && (spreadPercent ?? 100) <= 35) {
    confidence = "medium";
  } else {
    confidence = "low";
  }
  if (newestAge > 60) {
    notes.push(`Most recent comparable sale was ${Math.round(newestAge)} days ago.`);
    if (confidence === "high") confidence = "medium";
  }
  if ((spreadPercent ?? 0) > 35) {
    notes.push(`Sold prices vary widely (±${spreadPercent}%), so the estimate is uncertain.`);
  }

  return {
    estimatedValueUsd: roundMoney(estimate),
    confidence,
    compsUsed: pool,
    compsExcluded: excluded,
    basis,
    lowUsd: Math.min(...prices),
    highUsd: Math.max(...prices),
    spreadPercent,
    salesLast90Days,
    notes,
  };
}
