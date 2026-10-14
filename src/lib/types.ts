// Shared data shapes for CardHawk AI.
// All money values are stored in USD (the currency most sold-price data uses)
// and converted to AUD only for display.

export type Sport = "NBA" | "MLB" | "Pokemon" | "Other";
export type Grader = "PSA" | "BGS" | "SGC" | "CGC" | "RAW";
export type ListingFormat = "BUY_IT_NOW" | "AUCTION" | "BEST_OFFER";
export type DemandTier = "elite" | "high" | "medium" | "low";

/** Exact identity of a card. Two cards only "match" if all of these agree. */
export interface CardIdentity {
  sport: Sport;
  player: string;
  year: number;
  set: string;
  cardNumber: string;
  parallel: string | null; // e.g. "Refractor", "Silver Prizm"; null = base card
  serialNumbered: number | null; // print run, e.g. 99 for "/99"; null = not numbered
  variation: string | null; // e.g. "Image variation", "1st Edition"
  isRookie: boolean;
  grader: Grader;
  grade: number | null; // null for raw cards
}

/** A listing that is currently for sale (asking price, NOT market value). */
export interface Listing {
  id: string;
  isDemo: boolean;
  title: string;
  card: CardIdentity;
  format: ListingFormat;
  askingPriceUsd: number;
  buyerShippingUsd: number;
  listingUrl: string | null; // null for demo data — there is no real listing
  imageUrl: string | null;
  listedAt: string; // ISO date
  auctionEndsAt: string | null;
  seller: {
    feedbackScore: number;
    feedbackPercent: number;
  };
  hasBackPhoto: boolean;
  returnsAccepted: boolean;
  shipsFromCountry: string;
}

export type CompMatch = "exact" | "close";
export type CompSaleType = "AUCTION" | "BUY_IT_NOW" | "BEST_OFFER_ACCEPTED";

/** A completed (sold) sale used as market evidence. */
export interface SoldComp {
  id: string;
  isDemo: boolean;
  title: string;
  soldPriceUsd: number;
  soldDate: string; // ISO date
  saleType: CompSaleType;
  match: CompMatch; // exact = same card/parallel/grade; close = adjacent grade or similar
  source: string; // e.g. "eBay sold (demo)"
  sourceUrl: string | null;
}

export interface PopulationData {
  grader: Grader;
  grade: number;
  population: number;
  populationHigher: number;
  source: string;
  asOf: string;
}

export interface Settings {
  usdToAud: number; // 1 USD = x AUD
  fxIsManual: boolean;
  marketplaceFeeRate: number; // e.g. 0.1325 = 13.25 %
  marketplaceFixedFeeUsd: number; // per-order fixed fee
  outboundShippingUsd: number; // what it costs you to ship when reselling
  importTaxRate: number; // GST on imported low-value goods (AU) — 0.10
  otherCostsUsd: number; // supplies, grading, etc.
  minRoiPercent: number;
  minProfitUsd: number;
  /** How shipping to you is counted: eBay's quoted shipping, or a fixed amount per card (parcel locker). */
  inboundShippingMode: "ebay" | "fixed";
  inboundShippingFixedUsd: number;
}

export interface Holding {
  id: string;
  isDemo: boolean;
  title: string;
  card: CardIdentity;
  purchasePriceUsd: number;
  purchaseCostsUsd: number;
  purchasedAt: string;
  estimatedValueUsd: number | null;
  valueConfidence: Confidence;
  valueBasis?: string;
  note?: string | null;
}

export interface WatchlistItem {
  id: string;
  isDemo: boolean;
  listingId: string;
  note: string;
  addedAt: string;
  targetPriceUsd: number | null;
}

export type Confidence = "high" | "medium" | "low" | "none";

/** A card saved to the watchlist from the Manual Scanner (stored in Supabase). */
export interface WatchlistEntry {
  id: string;
  createdAt: string;
  title: string;
  card: CardIdentity;
  askingPriceUsd: number;
  buyerShippingUsd: number;
  expectedResaleUsd: number | null; // your estimate until verified sold data arrives (Phase 3)
  resaleBasis: string;
  targetPriceUsd: number | null;
  listingUrl: string | null;
  note: string | null;
}
