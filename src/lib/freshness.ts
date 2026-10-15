/**
 * Listing freshness (eBay API License Agreement §8.1.3: listing information shown in the
 * app may not be more than 6 hours older than eBay's own site).
 *
 * - Every stored scan result has a "last checked" time: when a scan found it, or when it
 *   was last re-checked on eBay.
 * - Results older than 6 hours are not shown with their eBay details.
 * - Each scan re-checks the listings that matter (valued cards) so live deals stay visible,
 *   and drops listings that have sold or ended.
 * Pure functions only — the eBay calls and database writes live in src/data/scanner.ts.
 */
import type { CardValue, ScanHit } from "./scan";
import { revalueHit } from "./scan";
import { toUsd, type EbayListing } from "./ebay/client";
import type { Settings } from "./types";

export const MAX_AGE_MS = 6 * 3_600_000;
/** Re-check a listing once it's this old, so it never reaches 6 hours between 3-hourly scans. */
export const RECHECK_AFTER_MS = 2.5 * 3_600_000;
/** Don't keep re-checking listings found more than this long ago. */
export const RECHECK_WINDOW_MS = 14 * 86_400_000;
export const MAX_RECHECKS_PER_SCAN = 60;

export type Freshness = { checkedAt?: string | null; status?: string | null; createdAt: string };

export function lastChecked(h: Freshness): number {
  return new Date(h.checkedAt ?? h.createdAt).getTime();
}

export function isEnded(h: Freshness): boolean {
  return h.status === "ended";
}

/** Can this result be shown with its eBay details right now? */
export function isFresh(h: Freshness, now = Date.now()): boolean {
  return !isEnded(h) && now - lastChecked(h) <= MAX_AGE_MS;
}

/**
 * Which stored results to re-check on eBay this scan: valued cards only (they're the ones
 * that can become or stay deals), not ended, found in the last 14 days, last checked 2.5h+ ago.
 * Deals first, then the closest to your max price. One entry per eBay item.
 */
export function pickRechecks<T extends ScanHit & Freshness & { searchId: string }>(
  hits: T[],
  settings: Settings,
  values: Map<string, CardValue>,
  now = Date.now(),
  limit = MAX_RECHECKS_PER_SCAN,
): T[] {
  const seen = new Set<string>();
  const out: { hit: T; deal: boolean; gap: number }[] = [];
  for (const h of hits) {
    if (seen.has(h.itemId) || isEnded(h)) continue;
    if (now - new Date(h.createdAt).getTime() > RECHECK_WINDOW_MS) continue;
    if (now - lastChecked(h) < RECHECK_AFTER_MS) continue;
    if (h.isAuction && h.endsAt && new Date(h.endsAt).getTime() <= now) continue;
    const r = revalueHit(h, settings, values);
    if (r.valueUsd === null) continue;
    seen.add(h.itemId);
    const gap = r.maxPriceUsd && r.priceUsd !== null ? (r.priceUsd - r.maxPriceUsd) / r.maxPriceUsd : Infinity;
    out.push({ hit: h, deal: r.meetsCriteria, gap });
  }
  out.sort((a, b) => Number(b.deal) - Number(a.deal) || a.gap - b.gap);
  return out.slice(0, limit).map((x) => x.hit);
}

export interface RecheckUpdate {
  status: "live" | "ended";
  checkedAt: string;
  priceUsd?: number | null;
  shippingUsd?: number;
  endsAt?: string | null;
  title?: string;
  imageUrl?: string | null;
  isAuction?: boolean;
}

/** Turn an eBay re-check into the fields to store. `listing` null = eBay says it no longer exists. */
export function recheckUpdate(listing: EbayListing | null, fx: number, now = new Date()): RecheckUpdate {
  const checkedAt = now.toISOString();
  if (!listing) return { status: "ended", checkedAt };
  const ended =
    listing.available === false || (listing.endsAt !== null && new Date(listing.endsAt).getTime() <= now.getTime());
  if (ended) return { status: "ended", checkedAt };
  return {
    status: "live",
    checkedAt,
    priceUsd: toUsd(listing.price, fx),
    shippingUsd: toUsd(listing.shipping, fx) ?? 0,
    endsAt: listing.endsAt,
    title: listing.title,
    imageUrl: listing.imageUrl,
    isAuction: listing.isAuction,
  };
}
