/**
 * eBay Browse API client — official, authorised access only.
 * Server-side only (it uses EBAY_CLIENT_SECRET). Never import from "use client" files.
 *
 * Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 *
 * What this gives us: ACTIVE listings (asking prices). It does NOT give sold
 * prices — asking prices are never treated as market value anywhere in the app.
 *
 * Every function returns { ok: false, error } instead of throwing, so a
 * missing key, an eBay outage or a rate limit shows a clear message.
 */
import { excludedBy } from "../exclude";
import type { Aspect } from "./parse";

export type Marketplace = "EBAY_US" | "EBAY_AU";

export interface EbayMoney {
  value: number;
  currency: string;
}

export interface EbayListing {
  itemId: string; // legacy numeric id
  title: string;
  price: EbayMoney | null; // Buy It Now price, or current bid for auctions
  isAuction: boolean;
  bidCount: number | null;
  acceptsOffers: boolean;
  shipping: EbayMoney | null; // to Australia when eBay provides it
  imageUrl: string | null;
  url: string;
  sellerFeedbackScore: number | null;
  sellerFeedbackPercent: number | null;
  returnsAccepted: boolean | null;
  country: string | null;
  listedAt: string | null;
  endsAt: string | null;
  aspects: Aspect[];
  condition: string | null;
}

export type EbayResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: number };

export const CATEGORY_IDS = {
  sportsCards: "261328", // Sports Trading Card Singles
  pokemon: "183454", // CCG Individual Cards
} as const;

const API = "https://api.ebay.com";
const TIMEOUT_MS = 12_000;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

// ---------- Access token (client credentials), cached until shortly before expiry ----------

let cached: { token: string; expiresAt: number } | null = null;

/** For tests only. */
export function resetTokenCache() {
  cached = null;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function getToken(force = false): Promise<EbayResult<string>> {
  if (!ebayConfigured()) {
    return { ok: false, error: "eBay isn't connected yet — add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET." };
  }
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return { ok: true, data: cached.token };

  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  try {
    const res = await timedFetch(`${API}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    });
    if (!res.ok) {
      return {
        ok: false,
        code: res.status,
        error:
          res.status === 401 || res.status === 400
            ? "eBay rejected the keys. Check EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are your Production keys."
            : `eBay sign-in failed (HTTP ${res.status}).`,
      };
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return { ok: false, error: "eBay sign-in returned no token." };
    cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 7200) * 1000 };
    return { ok: true, data: body.access_token };
  } catch (e) {
    return { ok: false, error: networkMessage(e) };
  }
}

function networkMessage(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "eBay took too long to respond. Try again in a moment.";
  return "Couldn't reach eBay. Check your connection and try again.";
}

async function call<T>(path: string, market: Marketplace): Promise<EbayResult<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt > 0);
    if (!token.ok) return token;
    let res: Response;
    try {
      res = await timedFetch(`${API}${path}`, {
        headers: {
          Authorization: `Bearer ${token.data}`,
          "X-EBAY-C-MARKETPLACE-ID": market,
          // Ask eBay for shipping costs to Australia.
          "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DAU",
          Accept: "application/json",
        },
      });
    } catch (e) {
      return { ok: false, error: networkMessage(e) };
    }
    if (res.status === 401 && attempt === 0) continue; // token expired early — refresh once
    if (res.status === 429) {
      return { ok: false, code: 429, error: "eBay's daily request limit has been reached. Try again later." };
    }
    if (res.status === 404) return { ok: false, code: 404, error: "That listing wasn't found — it may have ended or been removed." };
    if (!res.ok) return { ok: false, code: res.status, error: `eBay returned an error (HTTP ${res.status}).` };
    try {
      return { ok: true, data: (await res.json()) as T };
    } catch {
      return { ok: false, error: "eBay sent a response we couldn't read." };
    }
  }
  return { ok: false, error: "eBay sign-in keeps failing. Check your keys." };
}

// ---------- Mapping eBay's JSON into our shape ----------

type RawMoney = { value?: string; currency?: string } | undefined;
interface RawItem {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  price?: RawMoney;
  currentBidPrice?: RawMoney;
  bidCount?: number;
  buyingOptions?: string[];
  shippingOptions?: { shippingCost?: RawMoney; shippingCostType?: string }[];
  image?: { imageUrl?: string };
  itemWebUrl?: string;
  seller?: { feedbackScore?: number; feedbackPercentage?: string };
  returnTerms?: { returnsAccepted?: boolean };
  itemLocation?: { country?: string };
  itemCreationDate?: string;
  itemOriginDate?: string;
  itemEndDate?: string;
  localizedAspects?: { name?: string; value?: string }[];
  condition?: string;
}

function money(m: RawMoney): EbayMoney | null {
  if (!m?.value || !m.currency) return null;
  const v = Number(m.value);
  return Number.isFinite(v) ? { value: v, currency: m.currency } : null;
}

function legacyId(raw: RawItem): string {
  if (raw.legacyItemId) return raw.legacyItemId;
  const m = (raw.itemId ?? "").match(/v1\|(\d+)\|/);
  return m ? m[1] : raw.itemId ?? "";
}

export function mapItem(raw: RawItem): EbayListing {
  const options = raw.buyingOptions ?? [];
  const isAuction = options.includes("AUCTION") && !options.includes("FIXED_PRICE");
  const pct = Number(raw.seller?.feedbackPercentage);
  return {
    itemId: legacyId(raw),
    title: raw.title ?? "(untitled listing)",
    price: isAuction ? money(raw.currentBidPrice) ?? money(raw.price) : money(raw.price),
    isAuction,
    bidCount: typeof raw.bidCount === "number" ? raw.bidCount : null,
    acceptsOffers: options.includes("BEST_OFFER"),
    shipping: money(raw.shippingOptions?.[0]?.shippingCost),
    imageUrl: raw.image?.imageUrl ?? null,
    url: raw.itemWebUrl ?? `https://www.ebay.com/itm/${legacyId(raw)}`,
    sellerFeedbackScore: typeof raw.seller?.feedbackScore === "number" ? raw.seller.feedbackScore : null,
    sellerFeedbackPercent: Number.isFinite(pct) ? pct : null,
    returnsAccepted: typeof raw.returnTerms?.returnsAccepted === "boolean" ? raw.returnTerms.returnsAccepted : null,
    country: raw.itemLocation?.country ?? null,
    listedAt: raw.itemOriginDate ?? raw.itemCreationDate ?? null,
    endsAt: raw.itemEndDate ?? null,
    aspects: (raw.localizedAspects ?? [])
      .filter((a) => a.name && a.value)
      .map((a) => ({ name: a.name as string, value: a.value as string })),
    condition: raw.condition ?? null,
  };
}

/** Convert an eBay price to USD. Only USD and AUD are supported. */
export function toUsd(m: EbayMoney | null, usdToAud: number): number | null {
  if (!m) return null;
  if (m.currency === "USD") return Math.round(m.value * 100) / 100;
  if (m.currency === "AUD") return Math.round((m.value / usdToAud) * 100) / 100;
  return null;
}

// ---------- Public functions ----------

export async function getListing(itemId: string, market: Marketplace = "EBAY_US"): Promise<EbayResult<EbayListing>> {
  if (!/^\d{9,15}$/.test(itemId)) return { ok: false, error: "That doesn't look like an eBay item number." };
  const r = await call<RawItem>(`/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${itemId}`, market);
  return r.ok ? { ok: true, data: mapItem(r.data) } : r;
}

export interface SearchInput {
  q: string;
  market: Marketplace;
  category: keyof typeof CATEGORY_IDS;
  maxPrice: number | null; // in the marketplace's currency
  format: "ALL" | "FIXED_PRICE" | "AUCTION" | "BEST_OFFER";
  limit?: number;
  /** Hide listings whose title contains any of these whole words (applied after eBay returns results). */
  exclude?: string[];
}

export function buildSearchPath(s: SearchInput): string {
  const filters: string[] = [];
  const currency = s.market === "EBAY_AU" ? "AUD" : "USD";
  if (s.maxPrice !== null) filters.push(`price:[..${s.maxPrice}]`, `priceCurrency:${currency}`);
  filters.push(s.format === "ALL" ? "buyingOptions:{FIXED_PRICE|AUCTION}" : `buyingOptions:{${s.format}}`);
  const params = new URLSearchParams({
    q: s.q,
    category_ids: CATEGORY_IDS[s.category],
    filter: filters.join(","),
    sort: "newlyListed",
    limit: String(Math.min(Math.max(s.limit ?? 30, 1), 50)),
  });
  return `/buy/browse/v1/item_summary/search?${params.toString()}`;
}

export async function searchListings(
  s: SearchInput,
): Promise<EbayResult<{ total: number; items: EbayListing[]; excluded: number }>> {
  if (s.q.trim().length < 3) return { ok: false, error: "Enter at least 3 characters to search." };
  const r = await call<{ total?: number; itemSummaries?: RawItem[] }>(buildSearchPath(s), s.market);
  if (!r.ok) return r;
  const items = (r.data.itemSummaries ?? []).map(mapItem);
  // Remove duplicates (eBay occasionally repeats an item across pages/variations).
  const seen = new Set<string>();
  const unique = items.filter((i) => (seen.has(i.itemId) ? false : (seen.add(i.itemId), true)));
  const words = s.exclude ?? [];
  const kept = words.length ? unique.filter((i) => !excludedBy(i.title, words)) : unique;
  return { ok: true, data: { total: r.data.total ?? unique.length, items: kept, excluded: unique.length - kept.length } };
}
