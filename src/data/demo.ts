/**
 * ⚠️ DEMONSTRATION DATA ONLY ⚠️
 *
 * Every listing, sold comparison, price, seller and holding in this file is
 * made up so the dashboard has something to display in Phase 1.
 * None of it is a live opportunity and none of it came from eBay.
 * Card names describe real card types so the layout looks realistic,
 * but the prices are fictional. Population data is deliberately left out
 * (shown as "missing") because we never invent PSA/BGS population figures.
 *
 * Phase 3 replaces this file with real data from authorised sources.
 */

import type { Holding, Listing, SoldComp, WatchlistItem } from "@/lib/types";

/** All demo calculations are run "as of" this date so results never drift. */
export const DEMO_AS_OF = new Date("2026-10-10T00:00:00Z");

function daysAgo(n: number): string {
  return new Date(DEMO_AS_OF.getTime() - n * 86_400_000).toISOString();
}

/**
 * Build demo sold comps from a base price.
 * Each entry: [days ago, price multiplier, match, sale type]
 */
function comps(
  prefix: string,
  title: string,
  base: number,
  rows: [number, number, "exact" | "close", ("A" | "B" | "O")?][],
): SoldComp[] {
  const saleType = { A: "AUCTION", B: "BUY_IT_NOW", O: "BEST_OFFER_ACCEPTED" } as const;
  return rows.map(([ago, mult, match, t = "A"], i) => ({
    id: `${prefix}-c${i + 1}`,
    isDemo: true,
    title: match === "exact" ? title : `${title} (adjacent grade)`,
    soldPriceUsd: Math.round(base * mult),
    soldDate: daysAgo(ago),
    saleType: saleType[t],
    match,
    source: "Demo data — not a real sale",
    sourceUrl: null,
  }));
}

const goodSeller = { feedbackScore: 4210, feedbackPercent: 99.8 };

export const DEMO_LISTINGS: Listing[] = [
  {
    id: "demo-ohtani-us1-psa10",
    isDemo: true,
    title: "2018 Topps Update Shohei Ohtani #US1 Rookie PSA 10",
    card: {
      sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update",
      cardNumber: "US1", parallel: null, serialNumbered: null, variation: null,
      isRookie: true, grader: "PSA", grade: 10,
    },
    format: "BUY_IT_NOW",
    askingPriceUsd: 215,
    buyerShippingUsd: 18,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(0.2),
    auctionEndsAt: null,
    seller: goodSeller,
    hasBackPhoto: true,
    returnsAccepted: true,
    shipsFromCountry: "US",
  },
  {
    id: "demo-jordan-fleer57-psa6",
    isDemo: true,
    title: "1986 Fleer Michael Jordan #57 Rookie PSA 6",
    card: {
      sport: "NBA", player: "Michael Jordan", year: 1986, set: "Fleer",
      cardNumber: "57", parallel: null, serialNumbered: null, variation: null,
      isRookie: true, grader: "PSA", grade: 6,
    },
    format: "BEST_OFFER",
    askingPriceUsd: 2350,
    buyerShippingUsd: 35,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(1.5),
    auctionEndsAt: null,
    seller: { feedbackScore: 880, feedbackPercent: 99.4 },
    hasBackPhoto: true,
    returnsAccepted: false,
    shipsFromCountry: "US",
  },
  {
    id: "demo-charizard-base-psa8",
    isDemo: true,
    title: "1999 Pokémon Base Set Charizard #4/102 Holo PSA 8",
    card: {
      sport: "Pokemon", player: "Charizard", year: 1999, set: "Pokémon Base Set (Unlimited)",
      cardNumber: "4/102", parallel: "Holo", serialNumbered: null, variation: null,
      isRookie: false, grader: "PSA", grade: 8,
    },
    format: "BUY_IT_NOW",
    askingPriceUsd: 495,
    buyerShippingUsd: 22,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(0.6),
    auctionEndsAt: null,
    seller: goodSeller,
    hasBackPhoto: true,
    returnsAccepted: true,
    shipsFromCountry: "US",
  },
  {
    id: "demo-luka-prizm-silver-psa10",
    isDemo: true,
    title: "2018 Panini Prizm Luka Doncic #280 Silver Prizm Rookie PSA 10",
    card: {
      sport: "NBA", player: "Luka Doncic", year: 2018, set: "Panini Prizm",
      cardNumber: "280", parallel: "Silver Prizm", serialNumbered: null, variation: null,
      isRookie: true, grader: "PSA", grade: 10,
    },
    format: "AUCTION",
    askingPriceUsd: 720,
    buyerShippingUsd: 20,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(4),
    auctionEndsAt: daysAgo(-1.2),
    seller: { feedbackScore: 312, feedbackPercent: 100 },
    hasBackPhoto: true,
    returnsAccepted: false,
    shipsFromCountry: "US",
  },
  {
    id: "demo-ohtani-chrome-refractor-psa9",
    isDemo: true,
    title: "2018 Topps Chrome Shohei Ohtani #150 Refractor Rookie PSA 9",
    card: {
      sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Chrome",
      cardNumber: "150", parallel: "Refractor", serialNumbered: null, variation: null,
      isRookie: true, grader: "PSA", grade: 9,
    },
    format: "BEST_OFFER",
    askingPriceUsd: 340,
    buyerShippingUsd: 18,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(2),
    auctionEndsAt: null,
    seller: { feedbackScore: 41, feedbackPercent: 97.9 },
    hasBackPhoto: false,
    returnsAccepted: false,
    shipsFromCountry: "JP",
  },
  {
    id: "demo-lebron-chrome-bgs9",
    isDemo: true,
    title: "2003 Topps Chrome LeBron James #111 Rookie BGS 9",
    card: {
      sport: "NBA", player: "LeBron James", year: 2003, set: "Topps Chrome",
      cardNumber: "111", parallel: null, serialNumbered: null, variation: null,
      isRookie: true, grader: "BGS", grade: 9,
    },
    format: "BUY_IT_NOW",
    askingPriceUsd: 1650,
    buyerShippingUsd: 30,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(3),
    auctionEndsAt: null,
    seller: goodSeller,
    hasBackPhoto: true,
    returnsAccepted: true,
    shipsFromCountry: "US",
  },
  {
    id: "demo-trout-bdpp89-raw",
    isDemo: true,
    title: "2009 Bowman Chrome Draft Mike Trout #BDPP89 Prospect (Raw)",
    card: {
      sport: "MLB", player: "Mike Trout", year: 2009, set: "Bowman Chrome Draft",
      cardNumber: "BDPP89", parallel: null, serialNumbered: null, variation: null,
      isRookie: false, grader: "RAW", grade: null,
    },
    format: "BUY_IT_NOW",
    askingPriceUsd: 300,
    buyerShippingUsd: 15,
    listingUrl: null,
    imageUrl: null,
    listedAt: daysAgo(0.1),
    auctionEndsAt: null,
    seller: { feedbackScore: 1290, feedbackPercent: 99.1 },
    hasBackPhoto: false,
    returnsAccepted: true,
    shipsFromCountry: "US",
  },
];

export const DEMO_COMPS: Record<string, SoldComp[]> = {
  "demo-ohtani-us1-psa10": comps("ohtani-us1", "2018 Topps Update Ohtani #US1 PSA 10", 380, [
    [2, 1.0, "exact"], [5, 0.97, "exact", "B"], [9, 1.04, "exact"], [12, 0.99, "exact"],
    [18, 1.02, "exact", "O"], [24, 0.95, "exact"], [33, 1.01, "exact"], [41, 0.96, "exact"],
    [55, 1.06, "exact"], [70, 0.93, "exact"], [20, 0.55, "close"],
  ]),
  "demo-jordan-fleer57-psa6": comps("jordan-57", "1986 Fleer Jordan #57 PSA 6", 2700, [
    [6, 1.0, "exact"], [15, 0.96, "exact", "O"], [27, 1.05, "exact"], [44, 0.98, "exact"],
    [61, 1.02, "exact"], [80, 0.92, "exact"],
  ]),
  "demo-charizard-base-psa8": comps("zard-psa8", "1999 Base Set Charizard #4 PSA 8", 820, [
    [1, 1.02, "exact"], [4, 0.98, "exact"], [8, 1.0, "exact", "B"], [11, 0.97, "exact"],
    [16, 1.03, "exact"], [22, 0.99, "exact"], [29, 1.05, "exact"], [35, 0.96, "exact"],
    [47, 1.01, "exact"], [58, 0.94, "exact"], [3, 1.9, "exact"], // last one is an outlier
  ]),
  "demo-luka-prizm-silver-psa10": comps("luka-silver", "2018 Prizm Luka #280 Silver PSA 10", 1050, [
    [3, 1.0, "exact"], [10, 0.9, "exact"], [19, 1.12, "exact"], [37, 0.86, "exact"],
    [52, 1.18, "exact"],
  ]),
  "demo-ohtani-chrome-refractor-psa9": comps("ohtani-ref9", "2018 Topps Chrome Ohtani #150 Refractor PSA 9", 470, [
    [14, 1.0, "exact"], [40, 0.92, "exact", "O"], [9, 1.25, "close"], [26, 0.8, "close"],
  ]),
  "demo-lebron-chrome-bgs9": comps("lebron-111", "2003 Topps Chrome LeBron #111 BGS 9", 1480, [
    [4, 1.0, "exact"], [13, 1.03, "exact"], [21, 0.97, "exact"], [30, 1.01, "exact"],
    [46, 0.99, "exact"], [63, 1.04, "exact"],
  ]),
  "demo-trout-bdpp89-raw": comps("trout-raw", "2009 Bowman Chrome Draft Trout #BDPP89 raw", 420, [
    [12, 1.0, "exact"], [140, 0.9, "exact"],
  ]),
};

export const DEMO_WATCHLIST: WatchlistItem[] = [
  { id: "w1", isDemo: true, listingId: "demo-charizard-base-psa8", note: "Check centering on slab photo", addedAt: daysAgo(0.5), targetPriceUsd: 480 },
  { id: "w2", isDemo: true, listingId: "demo-ohtani-us1-psa10", note: "Strong comps — move fast", addedAt: daysAgo(0.1), targetPriceUsd: 205 },
  { id: "w3", isDemo: true, listingId: "demo-luka-prizm-silver-psa10", note: "Bid cap = max purchase price", addedAt: daysAgo(2), targetPriceUsd: null },
];

export const DEMO_HOLDINGS: Holding[] = [
  {
    id: "h1", isDemo: true, title: "2018 Topps Update Shohei Ohtani #US1 PSA 9",
    card: { sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update", cardNumber: "US1", parallel: null, serialNumbered: null, variation: null, isRookie: true, grader: "PSA", grade: 9 },
    purchasePriceUsd: 95, purchaseCostsUsd: 28, purchasedAt: daysAgo(120), estimatedValueUsd: 140, valueConfidence: "medium",
  },
  {
    id: "h2", isDemo: true, title: "1999 Pokémon Base Set Charizard #4/102 PSA 7",
    card: { sport: "Pokemon", player: "Charizard", year: 1999, set: "Pokémon Base Set (Unlimited)", cardNumber: "4/102", parallel: "Holo", serialNumbered: null, variation: null, isRookie: false, grader: "PSA", grade: 7 },
    purchasePriceUsd: 410, purchaseCostsUsd: 63, purchasedAt: daysAgo(75), estimatedValueUsd: 455, valueConfidence: "high",
  },
  {
    id: "h3", isDemo: true, title: "1996 Topps Chrome Kobe Bryant #138 Rookie (Raw)",
    card: { sport: "NBA", player: "Kobe Bryant", year: 1996, set: "Topps Chrome", cardNumber: "138", parallel: null, serialNumbered: null, variation: null, isRookie: true, grader: "RAW", grade: null },
    purchasePriceUsd: 160, purchaseCostsUsd: 21, purchasedAt: daysAgo(30), estimatedValueUsd: null, valueConfidence: "none",
  },
];

export const DEMO_SAVED_SEARCHES = [
  { id: "s1", name: "Ohtani rookies PSA 9–10 under US$600", keywords: "Shohei Ohtani rookie PSA", maxPriceUsd: 600, minScore: 65 },
  { id: "s2", name: "Jordan '86 Fleer any grade", keywords: "1986 Fleer Michael Jordan 57", maxPriceUsd: 5000, minScore: 60 },
  { id: "s3", name: "Base Set Charizard PSA 7+", keywords: "Base Set Charizard 4/102 PSA", maxPriceUsd: 1500, minScore: 65 },
];
