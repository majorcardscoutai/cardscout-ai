/**
 * Form validation. Turns raw form input into clean, typed data — or a clear
 * error message. Pure functions (no database, no UI) so they can be tested.
 * All money is converted to USD for storage.
 */
import { excludeWordsText, parseExcludeWords } from "./exclude";
import { OTHER_COUNTRIES, parseRegion, type BuyerRegion } from "./region";
import { cardDescription } from "./analysis";
import type { CardIdentity, Grader, Settings, Sport } from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const SPORTS: Sport[] = ["NBA", "MLB", "Pokemon", "Other"];
const GRADERS: Grader[] = ["PSA", "BGS", "SGC", "CGC", "RAW"];

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

interface NumOpts {
  min?: number;
  max?: number;
  optional?: boolean;
  integer?: boolean;
}

/** Parse a number typed by a person. Accepts "1,250.50" and "$1250". */
export function parseNumber(raw: string, label: string, opts: NumOpts = {}): Parsed<number | null> {
  // Allow "1,250", "$300", "A$300", "US$300", "300 AUD".
  const cleaned = raw.replace(/^(US|AU|A)?\$/i, "").replace(/\s*(USD|AUD)$/i, "").replace(/[,\s$]/g, "");
  if (cleaned === "") {
    return opts.optional ? { ok: true, value: null } : { ok: false, error: `${label} is required.` };
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` };
  if (opts.integer && !Number.isInteger(n)) return { ok: false, error: `${label} must be a whole number.` };
  if (opts.min !== undefined && n < opts.min) return { ok: false, error: `${label} must be at least ${opts.min}.` };
  if (opts.max !== undefined && n > opts.max) return { ok: false, error: `${label} must be at most ${opts.max}.` };
  return { ok: true, value: n };
}

export function toUsd(amount: number, currency: "USD" | "AUD", usdToAud: number): number {
  const usd = currency === "AUD" ? amount / usdToAud : amount;
  return Math.round(usd * 100) / 100;
}

function currencyOf(fd: FormData): "USD" | "AUD" {
  return str(fd, "currency") === "AUD" ? "AUD" : "USD";
}

/** Reads a money field and converts it to USD. */
function money(
  fd: FormData,
  name: string,
  label: string,
  fx: number,
  opts: NumOpts = {},
): Parsed<number | null> {
  const r = parseNumber(str(fd, name), label, { min: 0, ...opts });
  if (!r.ok || r.value === null) return r;
  return { ok: true, value: toUsd(r.value, currencyOf(fd), fx) };
}

export function parseCard(fd: FormData): Parsed<CardIdentity> {
  const sport = str(fd, "sport") as Sport;
  if (!SPORTS.includes(sport)) return { ok: false, error: "Choose a category (NBA, MLB, Pokémon or Other)." };

  const player = str(fd, "player");
  if (player.length < 2) return { ok: false, error: "Enter the player or Pokémon name." };
  if (player.length > 80) return { ok: false, error: "Player name is too long." };

  const thisYear = new Date().getFullYear();
  const year = parseNumber(str(fd, "year"), "Year", { min: 1880, max: thisYear + 1, integer: true });
  if (!year.ok) return year;

  const set = str(fd, "set");
  if (set.length < 2) return { ok: false, error: "Enter the set name (e.g. Topps Chrome)." };

  const cardNumber = str(fd, "cardNumber").replace(/^#/, "");
  if (!cardNumber) return { ok: false, error: "Enter the card number (e.g. 150 or US1)." };

  const serial = parseNumber(str(fd, "serialNumbered").replace(/^\//, ""), "Serial number (print run)", {
    optional: true,
    min: 1,
    max: 100000,
    integer: true,
  });
  if (!serial.ok) return serial;

  const grader = str(fd, "grader") as Grader;
  if (!GRADERS.includes(grader)) return { ok: false, error: "Choose a grading company, or Raw." };

  let grade: number | null = null;
  if (grader !== "RAW") {
    const g = parseNumber(str(fd, "grade"), "Grade", { min: 1, max: 10 });
    if (!g.ok) return g;
    if (g.value === null || (g.value * 2) % 1 !== 0) {
      return { ok: false, error: "Grade must be between 1 and 10, in steps of 0.5." };
    }
    grade = g.value;
  }

  return {
    ok: true,
    value: {
      sport,
      player,
      year: year.value as number,
      set,
      cardNumber,
      parallel: str(fd, "parallel") || null,
      serialNumbered: serial.value,
      variation: str(fd, "variation") || null,
      isRookie: str(fd, "isRookie") === "on" || str(fd, "isRookie") === "true",
      grader,
      grade,
    },
  };
}

function parseUrl(raw: string): Parsed<string | null> {
  if (!raw) return { ok: true, value: null };
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: "Listing link must be a full web address starting with https://" };
  }
}

export interface WatchlistInput {
  title: string;
  card: CardIdentity;
  askingPriceUsd: number;
  buyerShippingUsd: number;
  expectedResaleUsd: number | null;
  targetPriceUsd: number | null;
  listingUrl: string | null;
  note: string | null;
}

export function parseWatchlistForm(fd: FormData, usdToAud: number): Parsed<WatchlistInput> {
  const card = parseCard(fd);
  if (!card.ok) return card;
  const asking = money(fd, "asking", "Asking price", usdToAud);
  if (!asking.ok) return asking;
  const shipping = money(fd, "shipping", "Shipping", usdToAud, { optional: true });
  if (!shipping.ok) return shipping;
  const resale = money(fd, "resale", "Expected resale", usdToAud, { optional: true });
  if (!resale.ok) return resale;
  const target = money(fd, "target", "Target price", usdToAud, { optional: true });
  if (!target.ok) return target;
  const url = parseUrl(str(fd, "url"));
  if (!url.ok) return url;
  const note = str(fd, "note").slice(0, 500) || null;

  return {
    ok: true,
    value: {
      title: cardDescription(card.value),
      card: card.value,
      askingPriceUsd: asking.value as number,
      buyerShippingUsd: shipping.value ?? 0,
      expectedResaleUsd: resale.value,
      targetPriceUsd: target.value,
      listingUrl: url.value,
      note,
    },
  };
}

export interface HoldingInput {
  title: string;
  card: CardIdentity;
  purchasePriceUsd: number;
  purchaseCostsUsd: number;
  purchasedAt: string;
  estimatedValueUsd: number | null;
  note: string | null;
}

export function parseHoldingForm(fd: FormData, usdToAud: number, today = new Date()): Parsed<HoldingInput> {
  const card = parseCard(fd);
  if (!card.ok) return card;
  const price = money(fd, "purchasePrice", "Purchase price", usdToAud);
  if (!price.ok) return price;
  const costs = money(fd, "purchaseCosts", "Extra costs", usdToAud, { optional: true });
  if (!costs.ok) return costs;
  const value = money(fd, "estimatedValue", "Estimated value", usdToAud, { optional: true });
  if (!value.ok) return value;

  const dateRaw = str(fd, "purchasedAt");
  const date = dateRaw || today.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { ok: false, error: "Purchase date is not valid." };
  }
  if (Date.parse(date) > today.getTime() + 86_400_000) {
    return { ok: false, error: "Purchase date can't be in the future." };
  }

  return {
    ok: true,
    value: {
      title: cardDescription(card.value),
      card: card.value,
      purchasePriceUsd: price.value as number,
      purchaseCostsUsd: costs.value ?? 0,
      purchasedAt: date,
      estimatedValueUsd: value.value,
      note: str(fd, "note").slice(0, 500) || null,
    },
  };
}

/** Settings form: rates are typed as percentages (13.25) and stored as fractions (0.1325). */
export function parseSettingsForm(fd: FormData): Parsed<Settings> {
  const fields: [keyof Settings, string, string, NumOpts, number][] = [
    ["usdToAud", "usdToAud", "Exchange rate", { min: 0.5, max: 5 }, 1],
    ["marketplaceFeeRate", "feePercent", "Marketplace fee", { min: 0, max: 50 }, 100],
    ["marketplaceFixedFeeUsd", "fixedFee", "Fixed fee", { min: 0, max: 50 }, 1],
    ["outboundShippingUsd", "outboundShipping", "Shipping to buyer", { min: 0, max: 500 }, 1],
    ["importTaxRate", "importTaxPercent", "Tax on purchases", { min: 0, max: 50 }, 100],
    ["otherCostsUsd", "otherCosts", "Other costs", { min: 0, max: 500 }, 1],
    ["minRoiPercent", "minRoi", "Minimum ROI", { min: 0, max: 1000 }, 1],
    ["minProfitUsd", "minProfit", "Minimum profit", { min: 0, max: 100000 }, 1],
  ];
  const out: Partial<Settings> = { fxIsManual: true };
  for (const [key, name, label, opts, divisor] of fields) {
    const r = parseNumber(str(fd, name), label, opts);
    if (!r.ok) return r;
    (out as Record<string, unknown>)[key] = Math.round(((r.value as number) / divisor) * 1e6) / 1e6;
  }
  // Shipping to you: "ebay" (seller's quoted shipping) or "fixed" per card (parcel locker).
  out.inboundShippingMode = str(fd, "inboundShippingMode") === "fixed" ? "fixed" : "ebay";
  const fixed = parseNumber(str(fd, "inboundShippingFixed"), "Parcel locker cost per card", {
    optional: true,
    min: 0,
    max: 500,
  });
  if (!fixed.ok) return fixed;
  out.inboundShippingFixedUsd = fixed.value ?? 0;
  // Where you buy from.
  out.buyerRegion = parseRegion(str(fd, "buyerRegion"));
  const country = str(fd, "shipToCountry").toUpperCase();
  if (out.buyerRegion === "OTHER" && !OTHER_COUNTRIES.some(([c]) => c === country))
    return { ok: false, error: "Choose your country for \"Rest of the world\"." };
  out.shipToCountry = out.buyerRegion === "OTHER" ? country : null;
  const zip = str(fd, "shipToPostcode");
  if (out.buyerRegion === "US" && zip && !/^\d{5}$/.test(zip)) return { ok: false, error: "US ZIP code should be 5 digits (or leave it blank)." };
  out.shipToPostcode = out.buyerRegion === "US" && zip ? zip : null;
  return { ok: true, value: out as Settings };
}

// ---------- Card values & saved searches ----------

export interface CardValueInput {
  card: CardIdentity;
  title: string;
  valueUsd: number;
  note: string | null;
}

export function parseCardValueForm(fd: FormData, usdToAud: number): Parsed<CardValueInput> {
  const card = parseCard(fd);
  if (!card.ok) return card;
  const value = money(fd, "value", "Value", usdToAud);
  if (!value.ok) return value;
  if (!value.value) return { ok: false, error: "Value must be more than 0." };
  return {
    ok: true,
    value: { card: card.value, title: cardDescription(card.value), valueUsd: value.value, note: str(fd, "note").slice(0, 300) || null },
  };
}

export interface SavedSearchInput {
  name: string;
  query: string;
  market: "EBAY_US" | "EBAY_AU";
  category: "sportsCards" | "pokemon";
  format: "ALL" | "FIXED_PRICE" | "AUCTION" | "BEST_OFFER";
  maxPrice: number | null;
  excludeWords: string;
}

export function parseSavedSearchForm(fd: FormData): Parsed<SavedSearchInput> {
  const query = str(fd, "q");
  if (query.length < 3) return { ok: false, error: "Search words must be at least 3 characters." };
  if (query.length > 120) return { ok: false, error: "Search words are too long." };
  const max = parseNumber(str(fd, "max"), "Max price", { optional: true, min: 1, max: 1_000_000 });
  if (!max.ok) return max;
  const fmt = str(fd, "format");
  return {
    ok: true,
    value: {
      name: (str(fd, "name") || query).slice(0, 80),
      query,
      market: str(fd, "market") === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
      category: str(fd, "category") === "pokemon" ? "pokemon" : "sportsCards",
      format: fmt === "ALL" || fmt === "AUCTION" || fmt === "BEST_OFFER" ? fmt : "FIXED_PRICE",
      maxPrice: max.value,
      excludeWords: excludeWordsText(parseExcludeWords(str(fd, "x"))),
    },
  };
}

// ---------- Waitlist (public sign-up on the login page) ----------

export interface WaitlistInput {
  email: string;
  interests: string[]; // "NBA" | "MLB" | "Pokemon"
  region: BuyerRegion | null; // where they'd buy from (optional)
  goals: string[]; // "collecting" | "investing" | "flipping" | "business"
}

export const WAITLIST_GOALS: [string, string, string][] = [
  ["collecting", "Collecting", "Buying cards to keep for my collection"],
  ["investing", "Investing", "Buying and holding cards as they grow in value"],
  ["flipping", "Flipping", "Buying cards to resell for a profit"],
  ["business", "Card business", "I run a shop, do breaks or sell full-time"],
];

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

/** Validates a waitlist sign-up. `spam: true` = the hidden honeypot field was filled (a bot). */
export function parseWaitlistForm(fd: FormData): Parsed<WaitlistInput> & { spam?: boolean } {
  if (str(fd, "company")) return { ok: false, error: "spam", spam: true };
  const email = str(fd, "email").toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) return { ok: false, error: "Please enter a valid email address." };
  const interests = (["NBA", "MLB", "Pokemon"] as const).filter((k) => fd.get(`i_${k}`) === "on");
  const r = str(fd, "region");
  const region = r === "AU" || r === "US" || r === "OTHER" ? r : null;
  const goals = WAITLIST_GOALS.map(([k]) => k).filter((k) => fd.get(`g_${k}`) === "on");
  return { ok: true, value: { email, interests, region, goals } };
}
