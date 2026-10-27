/** eBay categories CardHawk searches (no server-only code here, so forms and pages can use it). */
export const CATEGORY_IDS = {
  sportsCards: "261328", // Sports Trading Card Singles
  pokemon: "183454", // CCG Individual Cards
  sportsSealed: "261332", // Sealed Sports Trading Card Boxes
  pokemonSealed: "2536", // Collectible Card Games (sealed Pokémon products are picked out by the sealed reader)
} as const;

export type SearchCategory = keyof typeof CATEGORY_IDS;

export function isSealedCategory(c: SearchCategory | undefined): boolean {
  return c === "sportsSealed" || c === "pokemonSealed";
}

export function parseCategory(v: unknown): SearchCategory {
  return v === "pokemon" || v === "sportsSealed" || v === "pokemonSealed" ? v : "sportsCards";
}
