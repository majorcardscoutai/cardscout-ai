/**
 * Deal score out of 100 for a live eBay listing — transparent, explainable, and it drops when the evidence
 * is thin. Built only from what CardHawk actually knows about the listing (no guessed data):
 *
 *   Discount to market ..... 25   how far below the market value the price is (40%+ below = full)
 *   Profit margin .......... 20   ROI after every fee and cost (60%+ = full)
 *   Profit size ............ 15   net profit in dollars (US$150+ = full) — a 50% ROI on $4 isn't a deal
 *   Sales evidence ......... 15   how often the card sells, per the price guide (weekly or more = full)
 *   Value confidence ....... 15   exact price for this grader/grade = full; any-company grade price = low
 *   Listing risk ........... 10   starts at 10; auction, off-centre (OC), stale eBay details take points off
 *                           ---
 *                           100
 *
 * Caps (the total can't go above them): no sales data 70 · fewer than 6 sales a year 75 ·
 * any-company grade price (BGS/CGC/SGC below 10) 60 · off-centre (OC) 60 · too good to be true (3× value or 150%+ ROI) 50.
 */
import { offCentreInTitle } from "./ebay/parse";

export interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface LiveScore {
  total: number;
  factors: ScoreFactor[];
  /** Why the total was held down, e.g. "Thin sales evidence — capped at 75". */
  caps: string[];
}

export interface LiveScoreInput {
  title: string;
  priceUsd: number | null;
  valueUsd: number | null;
  roiPercent: number | null;
  netProfitUsd: number | null;
  isAuction: boolean;
  /** Price-guide sales per year; null = unknown. */
  salesVolume: number | null | undefined;
  /** "you" = your own Card Value. */
  valueSource: string | null;
  /** The value is the guide's price for any grading company (e.g. "BGS 9"), not this grader's. */
  mixedGrade?: string | null;
  checkedAt?: string | null;
  createdAt?: string | null;
}

/** Above either of these, an automatic value is more likely wrong than the deal is real. */
export const TOO_GOOD_ROI = 150;
export const TOO_GOOD_MULTIPLE = 3;

/**
 * "Too good to be true": a price-guide value 3×+ the price, or 150%+ ROI. Real deals that big are rare;
 * wrong values (outlier sales, wrong parallel/grade/language) are not. Such listings are shown as
 * "Needs a manual check" — never ranked as a deal, never alerted. Your own Card Values are trusted.
 */
export function tooGoodReason(d: { valueSource?: string | null; valueUsd: number | null; priceUsd: number | null; roiPercent: number | null }): string | null {
  if ((d.valueSource ?? "you") === "you") return null;
  if (d.valueUsd !== null && d.priceUsd !== null && d.priceUsd > 0 && d.valueUsd >= d.priceUsd * TOO_GOOD_MULTIPLE)
    return `Guide value is ${(d.valueUsd / d.priceUsd).toFixed(1)}× the price — check it's the same card before buying`;
  if (d.roiPercent !== null && d.roiPercent > TOO_GOOD_ROI) return `${Math.round(d.roiPercent)}% ROI — check the value before buying`;
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const scale = (v: number, zeroAt: number, fullAt: number, max: number) => Math.round(clamp((v - zeroAt) / (fullAt - zeroAt), 0, 1) * max);

export function scoreLiveDeal(d: LiveScoreInput, now = Date.now()): LiveScore | null {
  if (d.valueUsd === null || d.priceUsd === null || d.valueUsd <= 0) return null; // no value, no score
  const factors: ScoreFactor[] = [];
  const caps: { at: number; why: string }[] = [];
  const own = (d.valueSource ?? "you") === "you";

  const discount = ((d.valueUsd - d.priceUsd) / d.valueUsd) * 100;
  factors.push({
    label: "Discount to market",
    points: scale(discount, 0, 40, 25),
    max: 25,
    detail: discount >= 0 ? `${discount.toFixed(0)}% below market value` : `${Math.abs(discount).toFixed(0)}% above market value`,
  });

  const roi = d.roiPercent ?? 0;
  factors.push({ label: "Profit margin", points: scale(roi, 0, 60, 20), max: 20, detail: `${roi.toFixed(1)}% ROI after fees, shipping and tax` });

  const profit = d.netProfitUsd ?? 0;
  factors.push({ label: "Profit size", points: scale(profit, 0, 150, 15), max: 15, detail: `US$${profit.toFixed(0)} net profit` });

  if (own) {
    factors.push({ label: "Sales evidence", points: 8, max: 15, detail: "Your own value — no price-guide sales data" });
  } else if (d.salesVolume === null || d.salesVolume === undefined) {
    factors.push({ label: "Sales evidence", points: 0, max: 15, detail: "Sales data not available" });
    caps.push({ at: 70, why: "No sales data" });
  } else {
    factors.push({ label: "Sales evidence", points: scale(d.salesVolume, 0, 52, 15), max: 15, detail: `Sells about ${d.salesVolume.toLocaleString("en-AU")} a year` });
    if (d.salesVolume < 6) caps.push({ at: 75, why: "Thin sales evidence (under 6 a year)" });
  }

  if (d.mixedGrade) {
    factors.push({ label: "Value confidence", points: 5, max: 15, detail: `${d.mixedGrade}: guide price is for any grading company` });
    caps.push({ at: 60, why: `${d.mixedGrade} valued at the any-company grade price` });
  } else if (own) {
    factors.push({ label: "Value confidence", points: 10, max: 15, detail: "Your own Card Value" });
  } else {
    factors.push({ label: "Value confidence", points: 15, max: 15, detail: "Exact price-guide match for this card and grade" });
  }

  let risk = 10;
  const notes: string[] = [];
  if (d.isAuction) {
    risk -= 3;
    notes.push("auction (price can rise)");
  }
  if (offCentreInTitle(d.title)) {
    risk -= 4;
    notes.push("off-centre (OC)");
    caps.push({ at: 60, why: "Off-centre (OC) card" });
  }
  const checked = d.checkedAt ?? d.createdAt;
  if (checked && now - new Date(checked).getTime() > 3 * 3_600_000) {
    risk -= 2;
    notes.push("eBay details over 3 hours old");
  }
  factors.push({ label: "Listing risk", points: clamp(risk, 0, 10), max: 10, detail: notes.length ? `Lower: ${notes.join(", ")}` : "No risk flags" });

  if (tooGoodReason({ valueSource: d.valueSource, valueUsd: d.valueUsd, priceUsd: d.priceUsd, roiPercent: d.roiPercent }))
    caps.push({ at: 50, why: "Too good to be true — needs a manual check" });

  const raw = factors.reduce((s, f) => s + f.points, 0);
  const cap = caps.reduce((m, c) => Math.min(m, c.at), 100);
  return {
    total: Math.min(raw, cap),
    factors,
    caps: raw > cap ? caps.filter((c) => c.at === cap).map((c) => `${c.why} — capped at ${c.at}`) : [],
  };
}

export function scoreBand(total: number): { label: string; tone: "gain" | "accent" | "warn" | "muted" } {
  if (total >= 80) return { label: "Strong deal", tone: "gain" };
  if (total >= 65) return { label: "Worth a look", tone: "accent" };
  if (total >= 50) return { label: "Marginal", tone: "warn" };
  return { label: "Weak", tone: "muted" };
}
