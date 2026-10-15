/**
 * Where the buyer is. Drives:
 *  - which address eBay quotes shipping to,
 *  - what the "tax" line is called (AU import GST / US sales tax / import VAT or duty),
 *  - whether amounts also show in A$ (Australia only — everyone else sees US$).
 */
import type { Settings } from "./types";

export type BuyerRegion = "AU" | "US" | "OTHER";

export const REGION_LABELS: Record<BuyerRegion, string> = {
  AU: "Australia",
  US: "United States",
  OTHER: "Rest of the world",
};

/** Countries offered for "Rest of the world" (eBay ships cards to all of these). */
export const OTHER_COUNTRIES: [string, string][] = [
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["NZ", "New Zealand"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["IT", "Italy"],
  ["ES", "Spain"],
  ["NL", "Netherlands"],
  ["SG", "Singapore"],
  ["HK", "Hong Kong"],
  ["JP", "Japan"],
  ["MX", "Mexico"],
  ["PH", "Philippines"],
  ["MY", "Malaysia"],
];

export function parseRegion(v: unknown): BuyerRegion {
  return v === "US" || v === "OTHER" ? v : "AU";
}

/** Two-letter country eBay should quote shipping to. */
export function shipToCountry(s: Pick<Settings, "buyerRegion" | "shipToCountry">): string {
  if (s.buyerRegion === "US") return "US";
  if (s.buyerRegion === "OTHER") {
    const c = (s.shipToCountry ?? "").toUpperCase();
    return /^[A-Z]{2}$/.test(c) && c !== "AU" && c !== "US" ? c : "GB";
  }
  return "AU";
}

export interface ShipTo {
  country: string;
  postcode?: string | null;
}

export function shipToFor(s: Pick<Settings, "buyerRegion" | "shipToCountry" | "shipToPostcode">): ShipTo {
  const country = shipToCountry(s);
  const postcode = country === "US" && s.shipToPostcode && /^\d{5}$/.test(s.shipToPostcode) ? s.shipToPostcode : null;
  return { country, postcode };
}

/** eBay's X-EBAY-C-ENDUSERCTX header value: where the buyer is, for shipping quotes. */
export function contextualLocation(t: ShipTo): string {
  const parts = [`country=${t.country}`];
  if (t.postcode) parts.push(`zip=${t.postcode}`);
  return `contextualLocation=${encodeURIComponent(parts.join(","))}`;
}

/** What the tax line is called for this buyer. */
export function taxLabel(region: BuyerRegion): string {
  return region === "US" ? "Sales tax" : region === "OTHER" ? "Import tax / VAT" : "Import GST";
}

export function taxHint(region: BuyerRegion): string {
  if (region === "US") return "eBay adds your state's sales tax at checkout — enter your rate (0 if none)";
  if (region === "OTHER") return "Your country's tax/duty on imported cards, e.g. UK 20, NZ 15";
  return "10% on imported cards; 0 for purchases within Australia";
}

/** Exchange rate to use for showing A$ next to US$ — 0 means "show US$ only". */
export function displayFx(s: Pick<Settings, "buyerRegion" | "usdToAud">): number {
  return s.buyerRegion === "AU" ? s.usdToAud : 0;
}

/** Does a listing shipped from `fromCountry` cross a border for this buyer? */
export function isImport(fromCountry: string | null, s: Pick<Settings, "buyerRegion" | "shipToCountry">): boolean {
  return !!fromCountry && fromCountry.toUpperCase() !== shipToCountry(s);
}
