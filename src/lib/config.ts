import type { DemandTier, Settings } from "./types";

/**
 * Default settings. In Phase 1 you change these by editing this file.
 * Phase 2 moves them into the database so you can edit them on the Settings page.
 *
 * IMPORTANT: these are starting assumptions, not facts.
 * - Check your real eBay fee rate for trading cards in your seller account.
 * - The exchange rate is entered manually until a live FX source is added (Phase 3).
 */
export const DEFAULT_SETTINGS: Settings = {
  usdToAud: 1.5, // manual placeholder — update to today's rate
  fxIsManual: true,
  marketplaceFeeRate: 0.1325,
  marketplaceFixedFeeUsd: 0.4,
  outboundShippingUsd: 5,
  importTaxRate: 0.1,
  otherCostsUsd: 2,
  minRoiPercent: 20,
  minProfitUsd: 25,
};

/**
 * Manual collector-demand tiers. This is a judgement call you control,
 * not market data. Players not listed default to "medium".
 */
export const DEMAND_TIERS: Record<string, DemandTier> = {
  "Shohei Ohtani": "elite",
  "Michael Jordan": "elite",
  "LeBron James": "high",
  "Luka Doncic": "high",
  "Mike Trout": "high",
  "Victor Wembanyama": "high",
  Charizard: "elite",
  Pikachu: "high",
};

export function demandTierFor(player: string): DemandTier {
  return DEMAND_TIERS[player] ?? "medium";
}
