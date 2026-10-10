import type { Confidence, DemandTier, Listing, PopulationData } from "./types";

/**
 * Transparent 100-point investment score.
 *
 *   Discount to market ........ 25
 *   Net profit margin (ROI) ... 20
 *   Collector demand .......... 15
 *   Comparable-sales quality .. 15
 *   Liquidity ................. 10
 *   Listing risk .............. 10   (more points = lower risk)
 *   Population / scarcity ......  5
 *                              ----
 *                               100
 *
 * Evidence rules:
 * - No verified market value → no score at all (null). We never guess.
 * - Missing population data earns only partial points and is flagged.
 * - The total is capped by valuation confidence: low ≤ 60, medium ≤ 85.
 */

export const SCORE_WEIGHTS = {
  discount: 25,
  margin: 20,
  demand: 15,
  compQuality: 15,
  liquidity: 10,
  listingRisk: 10,
  scarcity: 5,
} as const;

export const CONFIDENCE_CAPS: Record<Confidence, number> = {
  high: 100,
  medium: 85,
  low: 60,
  none: 0,
};

export interface ScoreFactor {
  key: keyof typeof SCORE_WEIGHTS;
  label: string;
  points: number;
  max: number;
  detail: string;
  missingData: boolean;
}

export interface ScoreInputs {
  askingPriceUsd: number;
  estimatedValueUsd: number | null;
  roiPercent: number | null;
  demandTier: DemandTier;
  valuationConfidence: Confidence;
  compsUsedCount: number;
  compBasis: "exact" | "close" | "insufficient";
  salesLast90Days: number;
  population: PopulationData | null;
  listing: Pick<
    Listing,
    "seller" | "hasBackPhoto" | "returnsAccepted" | "format" | "card"
  >;
}

export interface ScoreResult {
  total: number | null;
  rawTotal: number | null;
  cappedBy: Confidence | null;
  factors: ScoreFactor[];
  riskFlags: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Linear scale: value at `zeroAt` → 0 points, value at `fullAt` → max points. */
function scale(value: number, zeroAt: number, fullAt: number, max: number): number {
  return round1(clamp((value - zeroAt) / (fullAt - zeroAt), 0, 1) * max);
}

export function listingRiskFlags(listing: ScoreInputs["listing"]): string[] {
  const flags: string[] = [];
  if (listing.seller.feedbackScore < 50) flags.push("Seller has fewer than 50 feedback ratings");
  if (listing.seller.feedbackPercent < 98.5) flags.push("Seller positive feedback below 98.5%");
  if (!listing.hasBackPhoto) flags.push("No photo of the card back / slab back");
  if (!listing.returnsAccepted) flags.push("Returns not accepted");
  if (listing.card.grader === "RAW") flags.push("Raw card — condition can't be verified from photos");
  if (listing.format === "AUCTION") flags.push("Auction — final price may rise above the current bid");
  return flags;
}

export function scoreDeal(input: ScoreInputs): ScoreResult {
  const riskFlags = listingRiskFlags(input.listing);

  if (input.estimatedValueUsd === null || input.valuationConfidence === "none") {
    return {
      total: null,
      rawTotal: null,
      cappedBy: null,
      factors: [],
      riskFlags: ["No verified market value — cannot score", ...riskFlags],
    };
  }

  const factors: ScoreFactor[] = [];
  const W = SCORE_WEIGHTS;

  // 1. Discount to market: 0 % → 0 pts, 40 %+ below market → full.
  const discountPct =
    ((input.estimatedValueUsd - input.askingPriceUsd) / input.estimatedValueUsd) * 100;
  factors.push({
    key: "discount",
    label: "Discount to market",
    points: scale(discountPct, 0, 40, W.discount),
    max: W.discount,
    detail: `${discountPct >= 0 ? "" : "+"}${Math.abs(discountPct).toFixed(1)}% ${
      discountPct >= 0 ? "below" : "above"
    } estimated market value`,
    missingData: false,
  });

  // 2. Net profit margin: ROI 0 % → 0 pts, 60 %+ → full.
  const roi = input.roiPercent ?? 0;
  factors.push({
    key: "margin",
    label: "Net profit margin",
    points: scale(roi, 0, 60, W.margin),
    max: W.margin,
    detail: `${roi.toFixed(1)}% ROI after all fees and costs`,
    missingData: input.roiPercent === null,
  });

  // 3. Collector demand (manual tier).
  const demandPts = { elite: 15, high: 11, medium: 7, low: 3 }[input.demandTier];
  factors.push({
    key: "demand",
    label: "Collector demand",
    points: demandPts,
    max: W.demand,
    detail: `Demand tier: ${input.demandTier} (set manually in config)`,
    missingData: false,
  });

  // 4. Comparable-sales quality.
  const basePts = { high: 15, medium: 10, low: 5, none: 0 }[input.valuationConfidence];
  const compPts = input.compBasis === "close" ? Math.min(basePts, 6) : basePts;
  factors.push({
    key: "compQuality",
    label: "Comparable-sales quality",
    points: compPts,
    max: W.compQuality,
    detail: `${input.compsUsedCount} ${input.compBasis}-match sold comps · ${input.valuationConfidence} confidence`,
    missingData: false,
  });

  // 5. Liquidity: exact sales in last 90 days. 0 → 0, 10+ → full.
  factors.push({
    key: "liquidity",
    label: "Liquidity",
    points: scale(input.salesLast90Days, 0, 10, W.liquidity),
    max: W.liquidity,
    detail: `${input.salesLast90Days} exact-match sales in the last 90 days`,
    missingData: false,
  });

  // 6. Listing risk: start at full, subtract 2 per flag.
  factors.push({
    key: "listingRisk",
    label: "Listing risk",
    points: clamp(W.listingRisk - riskFlags.length * 2, 0, W.listingRisk),
    max: W.listingRisk,
    detail: riskFlags.length === 0 ? "No risk flags" : `${riskFlags.length} risk flag(s)`,
    missingData: false,
  });

  // 7. Population / scarcity.
  if (input.population) {
    const pop = input.population.population;
    const popPts = pop <= 50 ? 5 : pop <= 250 ? 4 : pop <= 1000 ? 3 : pop <= 5000 ? 2 : 1;
    factors.push({
      key: "scarcity",
      label: "Population / scarcity",
      points: popPts,
      max: W.scarcity,
      detail: `${input.population.grader} ${input.population.grade} pop ${pop.toLocaleString(
        "en-AU",
      )} (${input.population.source})`,
      missingData: false,
    });
  } else {
    const serial = input.listing.card.serialNumbered;
    factors.push({
      key: "scarcity",
      label: "Population / scarcity",
      points: serial !== null && serial <= 99 ? 3 : 2,
      max: W.scarcity,
      detail:
        serial !== null
          ? `Population data missing · serial numbered /${serial}`
          : "Population data missing — partial points only",
      missingData: true,
    });
  }

  const rawTotal = round1(factors.reduce((s, f) => s + f.points, 0));
  const cap = CONFIDENCE_CAPS[input.valuationConfidence];
  const total = Math.round(Math.min(rawTotal, cap));

  return {
    total,
    rawTotal,
    cappedBy: rawTotal > cap ? input.valuationConfidence : null,
    factors,
    riskFlags,
  };
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "Unscored";
  if (score >= 80) return "Strong buy signal";
  if (score >= 65) return "Worth a closer look";
  if (score >= 50) return "Marginal";
  return "Avoid";
}
