import { roundMoney } from "./currency";
import type { Settings } from "./types";

/**
 * Profitability engine.
 *
 *   Net Profit = Expected Resale − Purchase Price − Marketplace Fees − Shipping − Other Costs
 *   ROI        = Net Profit / Total Acquisition Cost × 100
 *
 * "Shipping" includes both shipping you pay to receive the card and shipping
 * you pay to send it when you resell. "Other costs" includes import GST and
 * any extra costs you set (supplies, grading, etc.).
 * All inputs and outputs are in USD.
 */

export interface ProfitInputs {
  purchasePriceUsd: number;
  buyerShippingUsd: number; // shipping you pay to receive the card
  expectedResaleUsd: number;
  settings: Pick<
    Settings,
    | "marketplaceFeeRate"
    | "marketplaceFixedFeeUsd"
    | "outboundShippingUsd"
    | "importTaxRate"
    | "otherCostsUsd"
  >;
}

export interface ProfitResult {
  purchasePriceUsd: number;
  importTaxUsd: number;
  buyerShippingUsd: number;
  otherCostsUsd: number;
  totalAcquisitionCostUsd: number;
  expectedResaleUsd: number;
  marketplaceFeesUsd: number;
  outboundShippingUsd: number;
  netProceedsUsd: number; // resale minus selling costs
  netProfitUsd: number;
  roiPercent: number;
}

function assertNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number (got ${value})`);
  }
}

export function marketplaceFees(
  resaleUsd: number,
  feeRate: number,
  fixedFeeUsd: number,
): number {
  if (resaleUsd <= 0) return 0;
  return roundMoney(resaleUsd * feeRate + fixedFeeUsd);
}

export function calculateProfit(input: ProfitInputs): ProfitResult {
  const { purchasePriceUsd, buyerShippingUsd, expectedResaleUsd, settings } = input;
  assertNonNegative("Purchase price", purchasePriceUsd);
  assertNonNegative("Buyer shipping", buyerShippingUsd);
  assertNonNegative("Expected resale", expectedResaleUsd);

  const importTaxUsd = roundMoney(purchasePriceUsd * settings.importTaxRate);
  const totalAcquisitionCostUsd = roundMoney(
    purchasePriceUsd + importTaxUsd + buyerShippingUsd + settings.otherCostsUsd,
  );
  const fees = marketplaceFees(
    expectedResaleUsd,
    settings.marketplaceFeeRate,
    settings.marketplaceFixedFeeUsd,
  );
  const netProceedsUsd = roundMoney(
    expectedResaleUsd - fees - settings.outboundShippingUsd,
  );
  const netProfitUsd = roundMoney(netProceedsUsd - totalAcquisitionCostUsd);
  const roiPercent =
    totalAcquisitionCostUsd > 0
      ? roundMoney((netProfitUsd / totalAcquisitionCostUsd) * 100)
      : 0;

  return {
    purchasePriceUsd,
    importTaxUsd,
    buyerShippingUsd,
    otherCostsUsd: settings.otherCostsUsd,
    totalAcquisitionCostUsd,
    expectedResaleUsd,
    marketplaceFeesUsd: fees,
    outboundShippingUsd: settings.outboundShippingUsd,
    netProceedsUsd,
    netProfitUsd,
    roiPercent,
  };
}

/**
 * The highest purchase price (before import tax and shipping) that still meets
 * BOTH your minimum ROI and your minimum dollar profit.
 * Returns null when no positive price works — i.e. the card isn't worth buying
 * at any price under your rules.
 */
export function maxPurchasePrice(
  expectedResaleUsd: number,
  buyerShippingUsd: number,
  settings: Pick<
    Settings,
    | "marketplaceFeeRate"
    | "marketplaceFixedFeeUsd"
    | "outboundShippingUsd"
    | "importTaxRate"
    | "otherCostsUsd"
    | "minRoiPercent"
    | "minProfitUsd"
  >,
): number | null {
  const fees = marketplaceFees(
    expectedResaleUsd,
    settings.marketplaceFeeRate,
    settings.marketplaceFixedFeeUsd,
  );
  const netProceeds = expectedResaleUsd - fees - settings.outboundShippingUsd;
  const fixedAcquisition = buyerShippingUsd + settings.otherCostsUsd;
  const r = settings.minRoiPercent / 100;

  // Total acquisition cost A = P × (1 + tax) + fixedAcquisition
  // ROI rule:    netProceeds − A ≥ r × A   →  A ≤ netProceeds / (1 + r)
  // Profit rule: netProceeds − A ≥ minProfit →  A ≤ netProceeds − minProfit
  const maxAcquisition = Math.min(
    netProceeds / (1 + r),
    netProceeds - settings.minProfitUsd,
  );
  const maxPrice = (maxAcquisition - fixedAcquisition) / (1 + settings.importTaxRate);

  if (!Number.isFinite(maxPrice) || maxPrice <= 0) return null;
  // Round DOWN to the cent so the rules are never broken by rounding.
  return Math.floor(maxPrice * 100) / 100;
}

/**
 * A suggested opening Best Offer. Heuristic, not market data:
 * start ~15 % under the asking price, but never above 90 % of your max price.
 */
export function recommendedOpeningOffer(
  askingPriceUsd: number,
  maxPriceUsd: number | null,
): number | null {
  if (maxPriceUsd === null) return null;
  const offer = Math.min(askingPriceUsd * 0.85, maxPriceUsd * 0.9);
  if (offer <= 0) return null;
  // Round down to a whole dollar — cleaner offers.
  return Math.floor(offer);
}
