import { demandTierFor } from "./config";
import {
  calculateProfit,
  maxPurchasePrice,
  recommendedOpeningOffer,
  type ProfitResult,
} from "./profit";
import { scoreDeal, type ScoreResult } from "./scoring";
import type { Confidence, Listing, PopulationData, Settings, SoldComp } from "./types";
import { estimateMarketValue, type ValuationResult } from "./valuation";

/**
 * Full investment assessment for one listing.
 * This module only COMBINES results — it does not fetch data.
 * Data acquisition (eBay, sold-price sources) stays in separate modules.
 */

/** Conservative haircut applied to market value to get expected resale. */
export const RESALE_HAIRCUT: Record<Confidence, number> = {
  high: 1,
  medium: 0.95,
  low: 0.9,
  none: 0,
};

export interface Assessment {
  listing: Listing;
  valuation: ValuationResult;
  expectedResaleUsd: number | null;
  profit: ProfitResult | null;
  maxPurchaseUsd: number | null;
  openingOfferUsd: number | null;
  discountPercent: number | null;
  score: ScoreResult;
  population: PopulationData | null;
  reasonsToBuy: string[];
  reasonsToAvoid: string[];
  meetsCriteria: boolean;
}

export function analyseListing(
  listing: Listing,
  comps: SoldComp[],
  population: PopulationData | null,
  settings: Settings,
  asOf: Date,
): Assessment {
  const valuation = estimateMarketValue(comps, asOf);
  const value = valuation.estimatedValueUsd;

  const expectedResaleUsd =
    value === null ? null : Math.round(value * RESALE_HAIRCUT[valuation.confidence] * 100) / 100;

  const profit =
    expectedResaleUsd === null
      ? null
      : calculateProfit({
          purchasePriceUsd: listing.askingPriceUsd,
          buyerShippingUsd: listing.buyerShippingUsd,
          expectedResaleUsd,
          settings,
        });

  const maxPurchaseUsd =
    expectedResaleUsd === null
      ? null
      : maxPurchasePrice(expectedResaleUsd, listing.buyerShippingUsd, settings);

  const openingOfferUsd =
    listing.format === "AUCTION"
      ? null
      : recommendedOpeningOffer(listing.askingPriceUsd, maxPurchaseUsd);

  const discountPercent =
    value === null ? null : Math.round(((value - listing.askingPriceUsd) / value) * 1000) / 10;

  const demandTier = demandTierFor(listing.card.player);

  const score = scoreDeal({
    askingPriceUsd: listing.askingPriceUsd,
    estimatedValueUsd: value,
    roiPercent: profit?.roiPercent ?? null,
    demandTier,
    valuationConfidence: valuation.confidence,
    compsUsedCount: valuation.compsUsed.length,
    compBasis: valuation.basis,
    salesLast90Days: valuation.salesLast90Days,
    population,
    listing,
  });

  const reasonsToBuy: string[] = [];
  const reasonsToAvoid: string[] = [];

  if (value === null) {
    reasonsToAvoid.push("Not enough verified sold data to value this card.");
  } else {
    if (discountPercent !== null && discountPercent >= 15)
      reasonsToBuy.push(`Asking price is ${discountPercent}% below recent sold prices.`);
    if (discountPercent !== null && discountPercent < 0)
      reasonsToAvoid.push(`Asking price is ${Math.abs(discountPercent)}% above recent sold prices.`);
    if (profit && profit.roiPercent >= settings.minRoiPercent)
      reasonsToBuy.push(`Projected ROI of ${profit.roiPercent}% beats your ${settings.minRoiPercent}% minimum.`);
    if (profit && profit.roiPercent < settings.minRoiPercent)
      reasonsToAvoid.push(`Projected ROI of ${profit.roiPercent}% is below your ${settings.minRoiPercent}% minimum.`);
    if (profit && profit.netProfitUsd < settings.minProfitUsd)
      reasonsToAvoid.push(`Net profit is below your US$${settings.minProfitUsd} minimum.`);
    if (valuation.confidence === "high")
      reasonsToBuy.push("Valuation backed by plenty of recent exact-match sales.");
    if (valuation.confidence === "low")
      reasonsToAvoid.push("Valuation confidence is low — few or inconsistent comparable sales.");
    if (valuation.salesLast90Days >= 8)
      reasonsToBuy.push("Sells often — should be easy to resell.");
    if (valuation.salesLast90Days <= 2)
      reasonsToAvoid.push("Rarely sells — may take a long time to resell.");
  }
  if (demandTier === "elite") reasonsToBuy.push(`${listing.card.player} is a top-demand name.`);
  valuation.notes.forEach((n) => reasonsToAvoid.push(n));
  score.riskFlags
    .filter((f) => !f.startsWith("No verified market value"))
    .forEach((f) => reasonsToAvoid.push(f));
  if (!population) reasonsToAvoid.push("Population data not available — scarcity unverified.");

  const meetsCriteria =
    profit !== null &&
    profit.roiPercent >= settings.minRoiPercent &&
    profit.netProfitUsd >= settings.minProfitUsd &&
    valuation.confidence !== "none";

  return {
    listing,
    valuation,
    expectedResaleUsd,
    profit,
    maxPurchaseUsd,
    openingOfferUsd,
    discountPercent,
    score,
    population,
    reasonsToBuy,
    reasonsToAvoid,
    meetsCriteria,
  };
}

export function cardDescription(card: Listing["card"]): string {
  const parts = [
    String(card.year),
    card.set,
    card.player,
    `#${card.cardNumber}`,
    card.parallel,
    card.serialNumbered ? `/${card.serialNumbered}` : null,
    card.variation,
    card.isRookie ? "RC" : null,
    card.grader === "RAW" ? "Raw" : `${card.grader} ${card.grade}`,
  ];
  return parts.filter(Boolean).join(" ");
}
