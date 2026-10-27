/** eBay categories CardHawk searches (no server-only code here, so forms and pages can use it). */
export const CATEGORY_IDS = {
  sportsCards: "261328", // Sports Trading Card Singles
  pokemon: "183454", // CCG Individual Cards
  sportsSealed: "261332", // Sealed Sports Trading Card Boxes
  pokemonSealed: "2536", // Collectible Card Games (sealed Pokémon products are picked out by the sealed reader)
} as const;

export type SearchCategory = keyof typeof CATEGORY_IDS;

/**
 * Sealed products (booster boxes, ETBs, hobby boxes) — built but switched OFF until single-card search is
 * perfected. Turn on later with SEALED_SEARCH=1 in Vercel (no code change needed).
 */
export function sealedEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((typeof process !== "undefined" ? process.env.SEALED_SEARCH : "") ?? "");
}

export function isSealedCategory(c: SearchCategory | undefined): boolean {
  return c === "sportsSealed" || c === "pokemonSealed";
}

export function parseCategory(v: unknown): SearchCategory {
  if (v === "pokemonSealed") return sealedEnabled() ? v : "pokemon";
  if (v === "sportsSealed") return sealedEnabled() ? v : "sportsCards";
  return v === "pokemon" ? v : "sportsCards";
}
