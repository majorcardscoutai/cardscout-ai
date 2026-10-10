import type { DealRow } from "@/components/DealsTable";
import type { Assessment } from "./analysis";

/** Convert a full Assessment into the small row shape the deals table needs. */
export function toDealRow(a: Assessment): DealRow {
  return {
    id: a.listing.id,
    title: a.listing.title,
    card: a.listing.card,
    format: a.listing.format,
    askingUsd: a.listing.askingPriceUsd,
    valueUsd: a.valuation.estimatedValueUsd,
    netProfitUsd: a.profit?.netProfitUsd ?? null,
    roiPercent: a.profit?.roiPercent ?? null,
    maxPurchaseUsd: a.maxPurchaseUsd,
    score: a.score.total,
    confidence: a.valuation.confidence,
    meetsCriteria: a.meetsCriteria,
    isDemo: a.listing.isDemo,
  };
}
