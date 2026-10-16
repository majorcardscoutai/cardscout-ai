/**
 * Pure scan logic: turn one eBay listing into a scored "hit".
 * No network or database calls — those live in src/data/scanner.ts.
 */
import { cardKey } from "./cardKey";
import { cardFromListing } from "./ebay/parse";
import { toUsd, type EbayListing } from "./ebay/client";
import { calculateProfit, maxPurchasePrice } from "./profit";
import type { Settings } from "./types";

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

export function evaluateListing(l: EbayListing, settings: Settings, values: Map<string, CardValue>): ScanHit {
  const priceUsd = toUsd(l.price, settings.usdToAud);
  const shippingUsd = shippingFor(l, settings);
  const key = cardKey(cardFromListing(l.title, l.aspects).card);
  const v = key ? values.get(key) ?? null : null;

  let netProfitUsd: number | null = null;
  let roiPercent: number | null = null;
  let maxPriceUsd: number | null = null;
  let meetsCriteria = false;

  if (v && priceUsd !== null) {
    const p = calculateProfit({ purchasePriceUsd: priceUsd, buyerShippingUsd: shippingUsd, expectedResaleUsd: v.valueUsd, settings });
    netProfitUsd = p.netProfitUsd;
    roiPercent = p.roiPercent;
    maxPriceUsd = maxPurchasePrice(v.valueUsd, shippingUsd, settings);
    meetsCriteria = p.roiPercent >= settings.minRoiPercent && p.netProfitUsd >= settings.minProfitUsd;
  }

  return {
    itemId: l.itemId,
    title: l.title,
    url: l.url,
    imageUrl: l.imageUrl,
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
  const parsed = cardKey(cardFromListing(h.title).card);
  const key = h.cardKey && values.has(h.cardKey) ? h.cardKey : parsed ?? h.cardKey;
  h = { ...h, cardKey: key };
  const v = key ? values.get(key) ?? null : null;
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
    meetsCriteria: p.roiPercent >= settings.minRoiPercent && p.netProfitUsd >= settings.minProfitUsd,
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
