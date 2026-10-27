/**
 * Pure scan logic: turn one eBay listing into a scored "hit".
 * No network or database calls — those live in src/data/scanner.ts.
 */
import { cardKey } from "./cardKey";
import { cardFromListing, qualifiedGradeInTitle, variationInTitle } from "./ebay/parse";
import { toUsd, type EbayListing } from "./ebay/client";
import { calculateProfit, maxPurchasePrice } from "./profit";
import { sealedFromTitle, sealedKey } from "./sealed";
import type { Settings, Sport } from "./types";

export interface CardValue {
  id: string;
  key: string;
  title: string;
  valueUsd: number;
  updatedAt: string;
  /** "you" = your Card Values (always wins); otherwise the automatic price guide. */
  source?: "you" | "sportscardspro" | "pricecharting";
  /** For automatic values: which price-guide card it matched, and whether the grade price is grader-specific. */
  matchedName?: string;
  graderSpecific?: boolean;
  /** Price guide: how many times this card sells per year (liquidity). */
  salesVolume?: number | null;
}

export interface ScanHit {
  itemId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  isAuction: boolean;
  endsAt: string | null;
  priceUsd: number | null;
  shippingUsd: number;
  cardKey: string | null;
  valueUsd: number | null; // from YOUR value book — not verified market data
  valueTitle: string | null;
  /** The seller's eBay user name. */
  sellerName?: string | null;
  /** Where the value came from ("you", "sportscardspro", "pricecharting"). */
  valueSource?: string | null;
  netProfitUsd: number | null;
  roiPercent: number | null;
  maxPriceUsd: number | null;
  meetsCriteria: boolean;
}

export function shippingFor(l: EbayListing, settings: Settings): number {
  if (settings.inboundShippingMode === "fixed") return settings.inboundShippingFixedUsd;
  return toUsd(l.shipping, settings.usdToAud) ?? 0;
}

/**
 * Which value-book key a listing uses: the card's key, or — for a sealed product (booster box, hobby box…)
 * — its sealed key. `units` = boxes in the listing (a case of 6), so the value covers all of them.
 */
export function listingKey(title: string, aspects: EbayListing["aspects"] = [], hint: { sport?: Sport } = {}): { key: string | null; units: number } {
  const key = cardKey(cardFromListing(title, aspects, hint).card);
  if (key) return { key, units: 1 };
  const sealed = sealedFromTitle(title, hint);
  return sealed.ok ? { key: sealedKey(sealed.item), units: sealed.item.quantity } : { key: null, units: 1 };
}

const forUnits = (v: CardValue, units: number): CardValue => (units === 1 ? v : { ...v, valueUsd: Math.round(v.valueUsd * units * 100) / 100, title: `${v.title} × ${units}` });

export function evaluateListing(l: EbayListing, settings: Settings, values: Map<string, CardValue>, hint: { sport?: Sport } = {}): ScanHit {
  const priceUsd = toUsd(l.price, settings.usdToAud);
  const shippingUsd = shippingFor(l, settings);
  const { key, units } = listingKey(l.title, l.aspects, hint);
  const found = usableValue(key ? values.get(key) ?? null : null, l.title, key);
  const v = found ? forUnits(found, units) : null;

  let netProfitUsd: number | null = null;
  let roiPercent: number | null = null;
  let maxPriceUsd: number | null = null;
  let meetsCriteria = false;

  if (v && priceUsd !== null) {
    const p = calculateProfit({ purchasePriceUsd: priceUsd, buyerShippingUsd: shippingUsd, expectedResaleUsd: v.valueUsd, settings });
    netProfitUsd = p.netProfitUsd;
    roiPercent = p.roiPercent;
    maxPriceUsd = maxPurchasePrice(v.valueUsd, shippingUsd, settings);
    meetsCriteria = p.roiPercent >= settings.minRoiPercent && p.netProfitUsd >= settings.minProfitUsd && dealGradeValue(v, key);
  }

  return {
    itemId: l.itemId,
    title: l.title,
    url: l.url,
    imageUrl: l.imageUrl,
    sellerName: l.sellerName ?? null,
    isAuction: l.isAuction,
    endsAt: l.endsAt,
    priceUsd,
    shippingUsd,
    cardKey: key,
    valueUsd: v?.valueUsd ?? null,
    valueTitle: v?.title ?? null,
    valueSource: v ? v.source ?? "you" : null,
    netProfitUsd,
    roiPercent,
    maxPriceUsd,
    meetsCriteria,
  };
}

/**
 * Re-price a hit that was saved earlier, using TODAY's Card Values and Settings.
 * Scan results are stored once, when first found — so a value you add later
 * (or a settings change) must be applied when the results are shown.
 */
export function revalueHit<T extends ScanHit>(h: T, settings: Settings, values: Map<string, CardValue>): T {
  // Re-read the title with today's parser (search results never carry item specifics),
  // so parser improvements also apply to listings found earlier.
  // A key you confirmed for this listing ("Add value") wins when you have a value for it.
  const read = listingKey(h.title);
  const key = h.cardKey && values.has(h.cardKey) ? h.cardKey : read.key ?? h.cardKey;
  h = { ...h, cardKey: key };
  const found = usableValue(key ? values.get(key) ?? null : null, h.title, key);
  const v = found ? forUnits(found, key === read.key ? read.units : 1) : null;
  const shippingUsd = settings.inboundShippingMode === "fixed" ? settings.inboundShippingFixedUsd : h.shippingUsd;
  const base = { ...h, shippingUsd, valueUsd: null, valueTitle: null, valueSource: null, netProfitUsd: null, roiPercent: null, maxPriceUsd: null, meetsCriteria: false };
  if (!v || h.priceUsd === null) return base;
  const p = calculateProfit({ purchasePriceUsd: h.priceUsd, buyerShippingUsd: shippingUsd, expectedResaleUsd: v.valueUsd, settings });
  return {
    ...base,
    valueUsd: v.valueUsd,
    valueTitle: v.title,
    valueSource: v.source ?? "you",
    netProfitUsd: p.netProfitUsd,
    roiPercent: p.roiPercent,
    maxPriceUsd: maxPurchasePrice(v.valueUsd, shippingUsd, settings),
    meetsCriteria: p.roiPercent >= settings.minRoiPercent && p.netProfitUsd >= settings.minProfitUsd && dealGradeValue(v, key),
  };
}

/** Should this hit trigger an alert? Auctions only when ending within 24 hours (early bids are meaningless). */
export function shouldAlert(h: ScanHit, now = new Date()): boolean {
  if (!h.meetsCriteria) return false;
  if (!h.isAuction) return true;
  if (!h.endsAt) return false;
  const hoursLeft = (new Date(h.endsAt).getTime() - now.getTime()) / 3_600_000;
  return hoursLeft > 0 && hoursLeft <= 24;
}

/** Auction with more than a day left: the current bid says nothing about the final price yet. */
export function auctionTooEarly(h: { isAuction: boolean; endsAt: string | null }, now = Date.now()): boolean {
  if (!h.isAuction || !h.endsAt) return false;
  return new Date(h.endsAt).getTime() - now > 24 * 3_600_000;
}

/** Auction that has already finished — no longer buyable. */
export function auctionEnded(h: { isAuction: boolean; endsAt: string | null }, now = Date.now()): boolean {
  return h.isAuction && !!h.endsAt && new Date(h.endsAt).getTime() <= now;
}

/**
 * Can this value flag a deal? The price guide's 7–9.5 prices are for any grading company and mostly
 * reflect PSA sales — BGS/SGC/CGC 9s usually sell for less. So for those, the value is shown but never
 * counts as a deal or alert. Your own Card Values always count.
 */
export function dealGradeValue(v: Pick<CardValue, "source" | "graderSpecific">, key: string | null): boolean {
  if ((v.source ?? "you") === "you" || v.graderSpecific !== false) return true;
  const grader = (key ?? "").split("|").at(-2) ?? "";
  return grader === "psa";
}

/**
 * A non-PSA graded card (e.g. BGS 9, CGC 9) valued with the guide's grade price for ANY grading company.
 * That price is mostly PSA sales, so the real value is usually lower. Returns "BGS 9" etc., or null.
 */
export function mixedGradeLabel(v: Pick<CardValue, "source" | "graderSpecific"> | null | undefined, key: string | null): string | null {
  if (!v || dealGradeValue(v, key)) return null;
  const parts = (key ?? "").split("|");
  const grader = (parts.at(-2) ?? "").toUpperCase();
  const grade = parts.at(-1) ?? "";
  return grader ? `${grader} ${grade}`.trim() : "This grade";
}

/**
 * Automatic values are dropped when the title shows the listing isn't the plain card that was valued:
 * a qualified grade ("8 (OC)") or a variation / stamped card the key doesn't include. Your own values always stand.
 */
export function usableValue<V extends Pick<CardValue, "source">>(v: V | null, title: string, key: string | null): V | null {
  if (!v || (v.source ?? "you") === "you") return v;
  if (qualifiedGradeInTitle(title)) return null;
  if (variationInTitle(title) && !(key ?? "").split("|").at(7)) return null;
  return v;
}
