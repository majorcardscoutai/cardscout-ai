/**
 * Sealed products (booster boxes, Elite Trainer Boxes, hobby boxes…): reading them from a listing title and
 * matching them to the price guide. The guide lists sealed items inside each set, with no card number, named
 * by product type ("Booster Box", "Hobby Box"); their sealed price is the guide's "Ungraded" (loose) price.
 *
 * Same rule as cards: if anything is unclear (type, set, language, how many boxes), no value — never a guess.
 */
import { setInTitle } from "./ebay/parse";
import type { ProviderProduct } from "./provider";
import type { Sport } from "./types";

export type SealedCategory = "Pokemon" | "MLB" | "NBA";

export interface SealedItem {
  category: SealedCategory;
  /** The guide's product name, e.g. "Booster Box". */
  type: string;
  set: string;
  /** Sports sets only (the guide's set names carry the year). */
  year: number | null;
  /** Boxes in the listing (a case of 6 = 6). The value shown is for all of them. */
  quantity: number;
}

export type SealedRead = { ok: true; item: SealedItem } | { ok: false; reason: string };

/** Product types, most specific first. `names` = how the guide spells it. */
const POKEMON_TYPES: { type: string; re: RegExp; names: string[] }[] = [
  { type: "Pokemon Center Elite Trainer Box", re: /\bpok[eé]mon center\b.*\b(elite trainer box|etb)\b|\b(elite trainer box|etb)\b.*\bpok[eé]mon center\b/i, names: ["Pokemon Center Elite Trainer Box"] },
  { type: "Elite Trainer Box", re: /\b(elite trainer box|etb)\b/i, names: ["Elite Trainer Box"] },
  { type: "Booster Bundle", re: /\bbooster bundle\b/i, names: ["Booster Bundle"] },
  { type: "Build & Battle Box", re: /\bbuild\s*(?:&|and|n)\s*battle box\b/i, names: ["Build & Battle Box", "Build And Battle Box"] },
  { type: "Sleeved Booster Pack", re: /\bsleeved booster( pack)?\b/i, names: ["Sleeved Booster Pack"] },
  { type: "3-Pack Blister", re: /\b3[- ]?pack blister\b/i, names: ["3-Pack Blister"] },
  { type: "Booster Box", re: /\bbooster (?:display )?box\b|\bbooster display\b/i, names: ["Booster Box"] },
  { type: "Booster Pack", re: /\bbooster pack\b/i, names: ["Booster Pack"] },
];
const SPORTS_TYPES: { type: string; re: RegExp; names: string[] }[] = [
  { type: "Hobby Box", re: /\bhobby box\b/i, names: ["Hobby Box"] },
  { type: "Blaster Box", re: /\bblaster box\b|\bblaster\b(?! pack)/i, names: ["Blaster Box"] },
  { type: "Mega Box", re: /\bmega box\b/i, names: ["Mega Box"] },
  { type: "Hanger Box", re: /\bhanger box\b/i, names: ["Hanger Box"] },
];

/** Never valued as a plain sealed box: breaks, opened or empty boxes, repacks, display-only, and similar. */
const NOT_A_SEALED_BOX =
  /\b(break|breaks|breaking|spots?|random (team|player|division)|pick your|pyt|empty|opened|open box|unsealed|resealed|re-sealed|no packs|repack|mystery|custom|digital|code cards?|art cards?|wrapper|box only|display only|damaged|jumbo|first day issue|fdi|choice|1st edition|shadowless)\b/i;
/** Packs from a box ("36 packs") are fine; these words mean a different language / print. */
const OTHER_LANGUAGE = /\b(japanese|japan|jp|jpn|korean|chinese|s-chinese|t-chinese|thai|indonesian|german|french|italian|spanish|portuguese)\b/i;

function quantityIn(title: string): number | null {
  const m =
    title.match(/\b(?:lot|set|case|bundle) of (\d{1,2})\b/i) ??
    title.match(/\b(\d{1,2})\s*(?:x|×)\s+\D/i) ??
    title.match(/\b(\d{1,2})x\b/i) ??
    title.match(/\bx\s?(\d{1,2})\b/i) ??
    title.match(/\b(\d{1,2})[- ]box(?:es)? (?:case|lot)\b/i) ??
    title.match(/\b(\d{1,2}) (?:sealed )?(?:booster |hobby |blaster |mega )?boxes\b/i);
  if (m) return Number(m[1]);
  // "Case" or "lot" without a count: we can't tell how many boxes.
  if (/\b(case|lot)\b/i.test(title)) return null;
  return 1;
}

function sportOf(title: string): SealedCategory | null {
  if (/pok[eé]mon/i.test(title)) return "Pokemon";
  if (/\b(basketball|nba)\b/i.test(title)) return "NBA";
  if (/\b(baseball|mlb)\b/i.test(title)) return "MLB";
  return null;
}

/** Is this title a sealed product, and which one exactly? */
export function sealedFromTitle(title: string, hint: { sport?: Sport } = {}): SealedRead {
  const hinted = hint.sport === "Pokemon" || hint.sport === "MLB" || hint.sport === "NBA" ? hint.sport : null;
  const category = sportOf(title) ?? hinted;
  if (!category) return { ok: false, reason: "sport or game unclear" };
  const types = category === "Pokemon" ? POKEMON_TYPES : SPORTS_TYPES;
  const t = types.find((x) => x.re.test(title));
  if (!t) return { ok: false, reason: "not a sealed product type CardHawk prices" };
  if (NOT_A_SEALED_BOX.test(title)) return { ok: false, reason: "break, opened, repack or special edition — no guide price" };
  if (OTHER_LANGUAGE.test(title)) return { ok: false, reason: "non-English product — not matched to English prices" };
  const quantity = quantityIn(title);
  if (quantity === null || quantity < 1 || quantity > 24) return { ok: false, reason: "number of boxes unclear (case or lot)" };
  const set = setInTitle(title, category);
  if (!set) return { ok: false, reason: "set not recognised" };
  let year: number | null = null;
  if (category !== "Pokemon") {
    const y = title.match(/\b(19[89]\d|20[0-4]\d)\b/);
    if (!y) return { ok: false, reason: "year missing" };
    year = Number(y[1]);
  }
  return { ok: true, item: { category, type: t.type, set, year, quantity } };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** One key per sealed product (quantity is not part of it — the value is per box). */
export function sealedKey(item: SealedItem): string {
  return ["sealed", item.category.toLowerCase(), item.year ?? "", norm(item.set), norm(item.type)].join("|");
}

/** Read a sealed key back (for lookups queued earlier). */
export function isSealedKey(key: string | null | undefined): boolean {
  return !!key && key.startsWith("sealed|");
}

const POKEMON_SERIES = ["scarlet violet", "sword shield", "sun moon", "xy", "black white", "diamond pearl", "heartgold soulsilver", "platinum", "ex"];

/** The guide's set name ("Pokemon Scarlet & Violet 151", "Baseball Cards 2023 Topps Chrome") fits this item? */
function setFits(item: SealedItem, consoleName: string): boolean {
  const c = norm(consoleName);
  if (item.category === "Pokemon") {
    if (!c.startsWith("pokemon ")) return false;
    const rest = c.slice("pokemon ".length);
    if (/\b(japanese|chinese|korean|german|french|italian|spanish|promo)\b/.test(rest)) return false;
    const s = norm(item.set);
    return rest === s || POKEMON_SERIES.some((series) => rest === `${series} ${s}`);
  }
  const prefix = item.category === "NBA" ? "basketball cards " : "baseball cards ";
  if (!c.startsWith(prefix)) return false;
  return c.slice(prefix.length) === `${item.year} ${norm(item.set)}`;
}

export type SealedMatch = { ok: true; product: ProviderProduct; usd: number | null } | { ok: false; reason: "no_match" | "ambiguous"; detail: string };

/** Exactly one guide product with this type and set; its sealed price is the "Ungraded" (loose) price. */
export function matchSealed(item: SealedItem, products: ProviderProduct[]): SealedMatch {
  const names = new Set([...(POKEMON_TYPES.find((t) => t.type === item.type)?.names ?? []), ...(SPORTS_TYPES.find((t) => t.type === item.type)?.names ?? [])].map(norm));
  const fits = products.filter((p) => names.has(norm(p.productName)) && setFits(item, p.consoleName));
  const unique = [...new Map(fits.map((p) => [p.id, p])).values()];
  if (unique.length === 0) return { ok: false, reason: "no_match", detail: `No ${item.type} for ${item.year ? `${item.year} ` : ""}${item.set} in the price guide.` };
  if (unique.length > 1) return { ok: false, reason: "ambiguous", detail: `Several products match (${unique.slice(0, 3).map((p) => p.consoleName).join("; ")}).` };
  const pennies = unique[0].prices["loose-price"];
  return { ok: true, product: unique[0], usd: pennies && pennies > 0 ? Math.round(pennies) / 100 : null };
}

/** What to type into the guide's search box for this product. */
export function sealedQuery(item: SealedItem): string {
  return [item.year, item.set, item.type].filter(Boolean).join(" ");
}

/** The guide product names CardHawk can price (for reading your downloaded Popular sets). */
export const SEALED_PRODUCT_NAMES = [...POKEMON_TYPES, ...SPORTS_TYPES].flatMap((t) => t.names);
