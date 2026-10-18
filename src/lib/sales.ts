/**
 * "Recent sales & slab check" on the Analyse page — pure helpers (no network).
 *
 * Recent sales are LINKS to the sources (eBay sold listings, the price guide, PSA auction prices):
 * CardHawk doesn't copy sales from websites. Slab checks use PSA's official API (see lib/psa.ts).
 */
import type { Aspect } from "./ebay/parse";
import type { CardIdentity } from "./types";

const EBAY_HOST = { EBAY_US: "https://www.ebay.com", EBAY_AU: "https://www.ebay.com.au" } as const;
const EBAY_CATEGORY = { sports: "261328", pokemon: "183454" } as const;

/** Words that describe the exact card, for search boxes. */
export function cardSearchText(card: Partial<CardIdentity>, opts: { grade?: boolean } = {}): string {
  const parallel = card.parallel && !/^base$/i.test(card.parallel) ? card.parallel : null;
  // eBay item specifics often say "2018 Topps Update" — don't repeat the year.
  const set = card.set ? card.set.replace(/^\s*(19|20)\d\d(-\d\d)?\s+/, "").trim() : null;
  const parts = [
    card.sport === "Pokemon" ? null : card.year,
    set,
    card.player,
    parallel,
    card.cardNumber ? `#${String(card.cardNumber).replace(/^#/, "")}` : null,
    opts.grade !== false && card.grader && card.grader !== "RAW" ? `${card.grader} ${card.grade ?? ""}`.trim() : null,
  ];
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** eBay's own sold-listings search for this card (most recent first). */
export function ebaySoldUrl(card: Partial<CardIdentity>, market: "EBAY_US" | "EBAY_AU", fallbackTitle?: string): string {
  const q = cardSearchText(card) || fallbackTitle || "";
  const params = new URLSearchParams({
    _nkw: q.slice(0, 200),
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "13", // ended recently first
    _sacat: card.sport === "Pokemon" ? EBAY_CATEGORY.pokemon : EBAY_CATEGORY.sports,
  });
  return `${EBAY_HOST[market]}/sch/i.html?${params}`;
}

/** The price guide's search for this card (its pages list recent sales). */
export function guideSearchUrl(card: Partial<CardIdentity>): { url: string; label: string } {
  const pokemon = card.sport === "Pokemon";
  const host = pokemon ? "https://www.pricecharting.com" : "https://www.sportscardspro.com";
  const params = new URLSearchParams({ q: cardSearchText(card, { grade: false }).slice(0, 200), type: "prices" });
  return { url: `${host}/search-products?${params}`, label: pokemon ? "PriceCharting" : "SportsCardsPro" };
}

export const PSA_AUCTION_PRICES_URL = "https://www.psacard.com/auctionprices";

/** The slab's certificate number from eBay item specifics (sellers fill this in for graded cards). */
export function certFromAspects(aspects: Aspect[]): string | null {
  const a = aspects.find((x) => /^(certification number|cert(ificate)? (number|no\.?|#)|psa cert(ification)? (number|#))$/i.test(x.name.trim()));
  const digits = a?.value.replace(/[^0-9]/g, "") ?? "";
  return digits.length >= 6 && digits.length <= 12 ? digits : null;
}

/** The grading company's own cert-lookup page (opens in a new tab). */
export function certLookupUrl(grader: string | null | undefined, cert: string): string | null {
  if (grader === "PSA") return `https://www.psacard.com/cert/${cert}`;
  if (grader === "CGC") return `https://www.cgccards.com/certlookup/${cert}/`;
  return null;
}

/** "GEM MT 10" → 10, "NM-MT 8" → 8, "MINT 9 (OC)" → 9, "AUTHENTIC" → null. */
export function psaGradeNumber(cardGrade: string | null | undefined): number | null {
  const m = (cardGrade ?? "").match(/(10|[1-9](?:\.5)?)(?!\d)/);
  return m ? Number(m[1]) : null;
}

export interface PsaCert {
  certNumber: string;
  year: string | null;
  brand: string | null;
  subject: string | null;
  cardNumber: string | null;
  variety: string | null;
  grade: string | null; // e.g. "GEM MT 10"
  population: number | null; // PSA graded at this grade
  populationHigher: number | null; // PSA graded higher
}

const words = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Does PSA's record for this slab agree with what the listing says?
 * Grade and card number must match; year and player are checked when both sides state them.
 */
export function compareCert(card: Partial<CardIdentity>, cert: PsaCert): { matches: boolean; issues: string[] } {
  const issues: string[] = [];
  const g = psaGradeNumber(cert.grade);
  if (card.grade !== undefined && card.grade !== null && g !== null && g !== card.grade)
    issues.push(`Listing says PSA ${card.grade}, but PSA's record says ${cert.grade}.`);
  const num = (x: string | null | undefined) => (x ?? "").replace(/^#/, "").split("/")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (card.cardNumber && cert.cardNumber && num(card.cardNumber) !== num(cert.cardNumber))
    issues.push(`Listing says card #${card.cardNumber}, but PSA's record says #${cert.cardNumber}.`);
  if (card.year && cert.year && card.sport !== "Pokemon" && !cert.year.includes(String(card.year)))
    issues.push(`Listing says ${card.year}, but PSA's record says ${cert.year}.`);
  if (card.player && cert.subject) {
    const have = new Set(words(cert.subject));
    const last = words(card.player).filter((w) => !/^(jr|sr|ii|iii|ex|v|gx|vmax|vstar)$/.test(w)).pop();
    if (last && !have.has(last)) issues.push(`Listing names ${card.player}, but PSA's record is for ${cert.subject}.`);
  }
  return { matches: issues.length === 0, issues };
}
