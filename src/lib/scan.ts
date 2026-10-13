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
    netProfitUsd,
    roiPercent,
    maxPriceUsd,
    meetsCriteria,
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
