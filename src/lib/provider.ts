/**
 * Automatic market values from SportsCardsPro (sports) / PriceCharting (Pokémon) — same company,
 * one Legendary subscription covers both (confirmed by Brady Haugh, 16 Oct 2026).
 *
 * Pure logic only (no network): build a search, decide whether a product is the SAME card,
 * and pick the price for the card's grade. A value is only used when the match is confident —
 * a wrong match (e.g. base card valued as a rare parallel) is worse than no value.
 *
 * Price fields (docs): loose=ungraded · cib=7/7.5 · new=8/8.5 · graded=9 · box-only=9.5 ·
 * manual-only=PSA 10 · bgs-10 · condition-17=CGC 10 · condition-18=SGC 10 ·
 * condition-9/10/13/14/15/16 = grades 1/2/3/4/5/6. Prices are integers in pennies (US cents).
 */
import type { CardIdentity } from "./types";

export interface ProviderProduct {
  id: string;
  productName: string; // e.g. "Shohei Ohtani #US1" or "Shohei Ohtani [Gold] #US1"
  consoleName: string; // e.g. "Baseball Cards 2018 Topps Update"
  prices: Record<string, number>; // field → pennies
  salesVolume: number | null; // units sold per year
}

export type ProviderSite = "sportscardspro" | "pricecharting";

export const PROVIDER_LABEL: Record<ProviderSite, string> = {
  sportscardspro: "SportsCardsPro",
  pricecharting: "PriceCharting",
};

export const PROVIDER_HOME: Record<ProviderSite, string> = {
  sportscardspro: "https://www.sportscardspro.com",
  pricecharting: "https://www.pricecharting.com",
};

export function siteFor(card: Partial<CardIdentity>): ProviderSite {
  return card.sport === "Pokemon" ? "pricecharting" : "sportscardspro";
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "") // "Bowman's" = "Bowmans"
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokens = (s: string | null | undefined) => norm(s).split(" ").filter(Boolean);

/** Card number as the guide writes it: "#US1" → "us1"; Pokémon "199/165" → "199", "GG54/GG70" → "gg54". */
export function normNumber(n: string | null | undefined): string {
  // Leading zeros don't matter: "015/172" = "#15", "GG05" = "GG5".
  return norm((n ?? "").replace(/^#/, "").split("/")[0]).replace(/[^a-z0-9]/g, "").replace(/(^|[a-z])0+(?=\d)/g, "$1");
}

const SET_STOPWORDS = new Set(["baseball", "basketball", "football", "cards", "card", "pokemon", "tcg", "the", "and", "of", "panini"]);
/** Pokémon guide names add a series prefix ("Scarlet & Violet 151") — allowed. These words mean a DIFFERENT product. */
const POKEMON_DIFFERENT = new Set(["japanese", "chinese", "korean", "german", "french", "italian", "spanish", "promo", "promos", "jumbo", "mcdonalds"]);
function setTokens(set: string | null | undefined, year?: number | null): string[] {
  return tokens(set).filter((t) => !SET_STOPWORDS.has(t) && t !== String(year ?? "") && !/^(19|20)\d\d$/.test(t));
}

/** Text for the provider's search box. */
export function buildQuery(card: Partial<CardIdentity>): string {
  const parts = [card.player, card.sport === "Pokemon" ? null : card.year, card.set, card.parallel, card.cardNumber ? `#${normNumber(card.cardNumber)}` : null];
  return parts.filter((p) => p !== null && p !== undefined && String(p).trim() !== "").join(" ").slice(0, 120);
}

export function parseProductName(name: string): { base: string; bracket: string | null; number: string | null } {
  const bracket = name.match(/\[([^\]]+)\]/)?.[1] ?? null;
  const number = name.match(/#\s*([A-Za-z0-9-]+)/)?.[1] ?? null;
  const base = name.replace(/\[[^\]]*\]/g, " ").replace(/#\s*[A-Za-z0-9-]+/, " ");
  return { base, bracket, number };
}

export interface MatchScore {
  ok: boolean;
  /** Lower is closer: extra words in the product's set name beyond the card's set. */
  extra: number;
  reason: string;
}

/** Is this product the same card (player, number, year, set, parallel, sport)? */
export function scoreProduct(card: Partial<CardIdentity>, p: ProviderProduct): MatchScore {
  const { base, bracket, number } = parseProductName(p.productName);
  const consoleN = norm(p.consoleName);
  if (!card.player || !card.cardNumber || !card.set) return { ok: false, extra: 99, reason: "card details incomplete" };

  const sportWord = card.sport === "MLB" ? "baseball" : card.sport === "NBA" ? "basketball" : card.sport === "Pokemon" ? "pokemon" : null;
  if (sportWord && !consoleN.includes(sportWord)) return { ok: false, extra: 99, reason: "different sport/game" };

  if (!number || normNumber(number) !== normNumber(card.cardNumber)) return { ok: false, extra: 99, reason: "different card number" };

  const baseTokens = new Set(tokens(base));
  if (!samePlayer(tokens(card.player), [...baseTokens])) return { ok: false, extra: 99, reason: "different player/character" };

  if (card.sport !== "Pokemon" && card.year && !consoleN.includes(String(card.year)) && !norm(p.productName).includes(String(card.year)))
    return { ok: false, extra: 99, reason: "different year" };

  const want = setTokens(card.set, card.year);
  const have = new Set(setTokens(p.consoleName, card.year));
  if (want.length === 0 || !want.every((t) => have.has(t))) return { ok: false, extra: 99, reason: "different set" };

  // Parallel must agree exactly: base card ↔ no bracket; a parallel ↔ a bracket naming it.
  const par = card.parallel && !/^(base|base set|base card|base cards|none|n\/a|na|no|standard|regular|not applicable|-)$/i.test(card.parallel.trim()) ? card.parallel : null;
  if (!par && bracket) return { ok: false, extra: 99, reason: `product is a parallel (${bracket})` };
  if (par) {
    if (!bracket) return { ok: false, extra: 99, reason: "product is the base card" };
    // Exact: "Refractor" ≠ "Gold Refractor" (print-run numbers like "/50" are checked separately below).
    const words = parallelWords;
    const bt = words(bracket);
    const pt = words(par);
    if (bt.size !== pt.size || ![...pt].every((t) => bt.has(t))) return { ok: false, extra: 99, reason: `different parallel (${bracket})` };
  }
  if (card.serialNumbered && !(bracket ?? "").includes(String(card.serialNumbered)))
    return { ok: false, extra: 99, reason: "print run not confirmed" };
  const v = variationAgrees(card, p.productName);
  if (v) return { ok: false, extra: 99, reason: v };

  // Sports: the guide's set must be exactly the card's set ("Bowman" ≠ "Bowman's Best", "Topps Update" ≠ "Topps Chrome Update").
  const wantSet = new Set(want);
  const extras = [...have].filter((t) => !wantSet.has(t));
  if (card.sport !== "Pokemon" && extras.length > 0) return { ok: false, extra: 99, reason: `different set (${p.consoleName})` };
  if (card.sport === "Pokemon" && extras.some((t) => POKEMON_DIFFERENT.has(t))) return { ok: false, extra: 99, reason: `different product (${p.consoleName})` };

  return { ok: true, extra: extras.length, reason: "match" };
}

export type PickResult =
  | { ok: true; product: ProviderProduct }
  | { ok: false; reason: "no_match" | "ambiguous"; detail: string };

/** Choose THE matching product, or none. Two equally good different products = ambiguous = no value. */
export function pickProduct(card: Partial<CardIdentity>, products: ProviderProduct[]): PickResult {
  const all = products.map((p) => ({ p, s: scoreProduct(card, p) }));
  let scored = all.filter((x) => x.s.ok);
  if (scored.length === 0 && card.serialNumbered) {
    // The guide often leaves the print run out of the name ("[Blue]" for Blue /150): accept only
    // when exactly one guide card fits and its parallel name shows no number at all.
    const relaxed = products
      .filter((p) => { const b = parseProductName(p.productName).bracket; return !!b && !/\d/.test(b); })
      .map((p) => ({ p, s: scoreProduct({ ...card, serialNumbered: null }, p) }))
      .filter((x) => x.s.ok);
    if (relaxed.length === 1) scored = relaxed;
  }
  if (scored.length === 0) {
    if (all.length === 0) return { ok: false, reason: "no_match", detail: "The price guide's search found nothing for this card." };
    // Show the closest few so you can see why (same number + player first).
    const near = all
      .filter((x) => !/different (card number|player)/.test(x.s.reason))
      .concat(all.filter((x) => /different (card number|player)/.test(x.s.reason)))
      .slice(0, 3)
      .map((x) => `${x.p.productName} · ${x.p.consoleName} (${x.s.reason})`);
    return { ok: false, reason: "no_match", detail: `Not an exact match. Closest in the guide: ${near.join("; ")}.` };
  }
  scored.sort((a, b) => a.s.extra - b.s.extra);
  if (scored.length > 1 && scored[1].s.extra === scored[0].s.extra && scored[1].p.id !== scored[0].p.id)
    return { ok: false, reason: "ambiguous", detail: `Several products match (${scored.slice(0, 3).map((x) => x.p.consoleName).join("; ")}).` };
  return { ok: true, product: scored[0].p };
}

const GRADE_FIELDS: Record<string, string> = {
  "1": "condition-9-price",
  "2": "condition-10-price",
  "3": "condition-13-price",
  "4": "condition-14-price",
  "5": "condition-15-price",
  "6": "condition-16-price",
  "7": "cib-price",
  "7.5": "cib-price",
  "8": "new-price",
  "8.5": "new-price",
  "9": "graded-price",
  "9.5": "box-only-price",
};

/** Which price field applies to this card's grade, and whether it's specific to the grading company. */
export function priceFieldFor(card: Partial<CardIdentity>): { field: string; graderSpecific: boolean } | null {
  if (card.grader === "RAW") return { field: "loose-price", graderSpecific: true };
  if (card.grade === 10) {
    const tens: Record<string, string> = { PSA: "manual-only-price", BGS: "bgs-10-price", CGC: "condition-17-price", SGC: "condition-18-price" };
    const f = tens[card.grader ?? ""];
    return f ? { field: f, graderSpecific: true } : null;
  }
  const f = card.grade !== undefined && card.grade !== null ? GRADE_FIELDS[String(card.grade)] : undefined;
  return f ? { field: f, graderSpecific: false } : null;
}

/** Grade price fields from lowest to highest grade (PSA 10 last). */
const GRADE_ORDER = ["condition-9-price", "condition-10-price", "condition-13-price", "condition-14-price", "condition-15-price", "condition-16-price", "cib-price", "new-price", "graded-price", "box-only-price", "manual-only-price"];

/**
 * The guide's prices for this card don't make sense: a grade costs much more (1.5×+) than a HIGHER grade of the
 * same card. That happens when other cards' sales are filed under this one; such a price is never used.
 */
export function inconsistentGradePrice(prices: Record<string, number>, field: string): string | null {
  const i = GRADE_ORDER.indexOf(field);
  if (i < 0) return null;
  const mine = prices[field];
  if (!mine) return null;
  for (const higher of GRADE_ORDER.slice(i + 1)) {
    const hp = prices[higher];
    if (hp && hp > 0 && mine > hp * 1.5) return higher;
  }
  return null;
}

/** A 10 can't be checked against a higher grade, so it's checked against the grades just below it. */
const TEN_FIELDS = new Set(["manual-only-price", "bgs-10-price", "condition-17-price", "condition-18-price"]);
const TEN_LIMITS: [string, number][] = [
  ["box-only-price", 5], // 9.5
  ["graded-price", 8], // 9
];

/**
 * The guide's 10 price is wildly above its 9.5 / 9 price for the same card (5× a 9.5 or 8× a 9) — usually one
 * odd or mis-filed sale (e.g. 2002 Bowman Chrome Jeter #2: PSA 10 listed at US$1,441 while PSA 10s sell for
 * about US$45–100). Returns the lower grade's field it was checked against, or null if it looks fine.
 * Real gem premiums can be big, so this only catches extreme gaps; a caught card shows no value rather than a false deal.
 */
export function outlierTenPrice(prices: Record<string, number>, field: string): string | null {
  if (!TEN_FIELDS.has(field)) return null;
  const ten = prices[field];
  if (!ten || ten <= 0) return null;
  for (const [lower, limit] of TEN_LIMITS) {
    const lp = prices[lower];
    if (lp && lp > 0) return ten > lp * limit ? lower : null; // compare with the nearest grade that has a price
  }
  return null;
}

export function priceFor(card: Partial<CardIdentity>, p: ProviderProduct): { usd: number; field: string; graderSpecific: boolean } | null {
  const f = priceFieldFor(card);
  if (!f) return null;
  const pennies = p.prices[f.field];
  if (!pennies || pennies <= 0) return null;
  if (inconsistentGradePrice(p.prices, f.field) || outlierTenPrice(p.prices, f.field)) return null;
  return { usd: Math.round(pennies) / 100, ...f };
}

/** Turn one product object from the API into our shape (prices in pennies). */
export function parseApiProduct(raw: unknown): ProviderProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id ?? r["product-id"];
  const name = r["product-name"];
  if ((typeof id !== "string" && typeof id !== "number") || typeof name !== "string") return null;
  const prices: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k.endsWith("-price") && !k.startsWith("retail-")) {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (Number.isFinite(n)) prices[k] = n;
    }
  }
  const sv = Number(r["sales-volume"]);
  return {
    id: String(id),
    productName: name,
    consoleName: typeof r["console-name"] === "string" ? (r["console-name"] as string) : "",
    prices,
    salesVolume: Number.isFinite(sv) ? sv : null,
  };
}


// ---------- Set-name fallback: title has player/year/number/grade but a set we don't recognise ----------

/** "Baseball Cards 2018 Topps Chrome Update" → "Topps Chrome Update"; "Pokemon Evolutions" → "Evolutions". */
export function consoleSet(consoleName: string): string {
  return consoleName
    .replace(/^\s*(baseball|basketball|football|hockey|soccer|racing|wrestling)\s+cards\s+/i, "")
    .replace(/^\s*pok[eé]mon\s+/i, "")
    .replace(/^\s*(19|20)\d\d(-\d\d)?\s+/, "")
    .trim();
}

export type SetMatch =
  | { ok: true; product: ProviderProduct; set: string; player: string }
  | { ok: false; reason: "no_match" | "ambiguous"; detail: string };

/**
 * Pick the guide card whose OWN player name and set name both appear word-for-word in the listing title,
 * with the same sport, year (sports), card number and parallel. Most specific set wins
 * ("Topps Chrome Update" over "Topps Update" when the title says both). Two equally good → no value.
 */
export function matchBySetInTitle(card: Partial<CardIdentity>, title: string, products: ProviderProduct[]): SetMatch {
  const titleTok = new Set(tokens(title));
  const sportWord = card.sport === "MLB" ? "baseball" : card.sport === "NBA" ? "basketball" : card.sport === "Pokemon" ? "pokemon" : null;
  const par = card.parallel && !/^(base|base set|none|n\/a)$/i.test(card.parallel.trim()) ? card.parallel : null;
  const words = parallelWords;
  const ok: { p: ProviderProduct; score: number; set: string; player: string }[] = [];
  for (const p of products) {
    const { base, bracket, number } = parseProductName(p.productName);
    const consoleN = norm(p.consoleName);
    if (sportWord && !consoleN.includes(sportWord)) continue;
    if (!number || normNumber(number) !== normNumber(card.cardNumber)) continue;
    if (card.sport !== "Pokemon" && card.year && !consoleN.includes(String(card.year))) continue;
    const baseTok = tokens(base);
    if (baseTok.length < (card.sport === "Pokemon" ? 1 : 2) || !baseTok.every((t) => titleTok.has(t))) continue;
    const setTok = setTokens(p.consoleName, card.year);
    if (setTok.length === 0 || !setTok.every((t) => titleTok.has(t))) continue;
    if (card.sport === "Pokemon" && setTok.some((t) => POKEMON_DIFFERENT.has(t))) continue;
    if (!par && bracket) continue;
    if (par) {
      if (!bracket) continue;
      const bt = words(bracket);
      const pt = words(par);
      if (bt.size !== pt.size || ![...pt].every((t) => bt.has(t))) continue;
    }
    if (card.serialNumbered && !(bracket ?? "").includes(String(card.serialNumbered))) continue;
    if (variationAgrees(card, p.productName)) continue;
    ok.push({ p, score: setTok.length + baseTok.length, set: consoleSet(p.consoleName), player: base.replace(/\s+/g, " ").trim() });
  }
  if (ok.length === 0) return { ok: false, reason: "no_match", detail: "No guide card's player and set both appear in the title." };
  ok.sort((a, b) => b.score - a.score);
  if (ok.length > 1 && ok[1].score === ok[0].score && ok[1].p.id !== ok[0].p.id)
    return { ok: false, reason: "ambiguous", detail: `Several guide cards fit the title (${ok.slice(0, 3).map((x) => x.p.consoleName).join("; ")}).` };
  return { ok: true, product: ok[0].p, set: ok[0].set, player: ok[0].player };
}

/** Same card, any grade: the cache key without its grader + grade parts. One lookup prices every grade. */
export function sameCardKey(key: string): string {
  return key.split("|").slice(0, -2).join("|");
}

/** Parallel name words for comparing: print-run numbers dropped; "Refractor"/"Prizm" optional
 *  (the guide writes a Chrome "Blue Refractor" as "[Blue]", a Prizm "Silver Prizm" as "[Silver]"). */
function parallelWords(x: string): Set<string> {
  // "Variation"/"Stamped" are checked separately (variationAgrees), so they don't count here.
  return new Set(tokens(x).filter((t) => !/^\d+$/.test(t.replace("/", "")) && !VARIATION_WORDS.has(t) && t !== "refractor" && t !== "refractors" && t !== "prizm"));
}

const VARIATION_WORDS = new Set(["variation", "variations", "var", "stamp", "stamped"]);

/**
 * Variations and stamped cards are different cards with the same number ("1957-58 Variation", image
 * variations, prerelease/staff stamps). Listing and guide card must agree: null = they do, else why not.
 */
export function variationAgrees(card: Partial<CardIdentity>, productName: string): string | null {
  const name = productName.toLowerCase();
  const productVar = /\bvar(iation)?s?\b/.test(name);
  const productStamp = /\bstamp(ed)?\b/.test(name);
  const v = (card.variation ?? "").toLowerCase();
  if (!v) return productVar || productStamp ? "guide card is a variation / stamped version" : null;
  if (/stamp/.test(v)) return productStamp ? null : "listing is a stamped card; guide card isn't";
  return productVar ? null : "listing is a variation; guide card isn't";
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Same player: every word appears; or the surname appears exactly and each other word appears
 *  or is one letter off a word that's there ("Satchel" / "Satchell"; words of 4+ letters only). */
export function samePlayer(want: string[], have: string[]): boolean {
  const h = new Set(have);
  if (want.every((t) => h.has(t))) return true;
  const w = want.filter((t) => !/^(jr|sr|ii|iii)$/.test(t));
  if (w.length < 2 || !h.has(w[w.length - 1])) return false;
  return w.slice(0, -1).every((t) => h.has(t) || (t.length >= 4 && have.some((x) => x.length >= 4 && editDistance(t, x) <= 1)));
}
