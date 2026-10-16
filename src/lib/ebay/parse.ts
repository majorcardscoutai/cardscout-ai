/**
 * Pure helpers for eBay data — no network calls, so they can be unit-tested.
 *
 * - itemIdFromUrl: pull the item number out of a pasted eBay link.
 * - cardFromListing: SUGGEST a card identity from the listing's item specifics
 *   and title. It is a starting point for you to confirm, never a final answer:
 *   sellers often mislabel parallels, numbers and grades.
 */
import { DEMAND_TIERS } from "../config";
import type { CardIdentity, Grader, Sport } from "../types";

const EBAY_HOST = /(^|\.)ebay\.(com|com\.au|co\.uk|ca|de|fr|it|es|ie|at|ch|nl|be|pl|com\.hk|com\.sg|com\.my|ph|in)$/i;

/** Returns the numeric eBay item ID from a listing URL, or null. */
export function itemIdFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Allow a bare item number too.
    return /^\d{9,15}$/.test(raw.trim()) ? raw.trim() : null;
  }
  if (!EBAY_HOST.test(url.hostname)) return null;
  // /itm/123456789012  or  /itm/some-title/123456789012
  const path = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/);
  if (path) return path[1];
  const q = url.searchParams.get("item") ?? url.searchParams.get("itm");
  if (q && /^\d{9,15}$/.test(q)) return q;
  return null;
}

export interface Aspect {
  name: string;
  value: string;
}

export interface CardSuggestion {
  card: Partial<CardIdentity>;
  /** Fields we could not work out — you must fill these in. */
  missing: string[];
  /** Where each field came from, for transparency. */
  sources: Record<string, "item specifics" | "title">;
}

const SETS_RAW = [
  // Baseball / multi-sport
  "Topps Chrome Update", "Topps Chrome Sapphire", "Topps Chrome", "Topps Update", "Topps Series 1", "Topps Series 2",
  "Topps Heritage", "Topps Finest", "Topps Stadium Club", "Stadium Club", "Topps Allen & Ginter", "Allen & Ginter",
  "Topps Gypsy Queen", "Gypsy Queen", "Topps Archives", "Topps Tribute", "Topps Inception", "Topps Tier One",
  "Topps Dynasty", "Topps Museum Collection", "Topps Big League", "Topps Gold Label", "Topps Opening Day", "Topps Now",
  "Topps Fire", "Topps Pristine", "Topps Sterling", "Topps Triple Threads", "Topps Five Star", "Topps Definitive",
  "Bowman Chrome Draft", "Bowman Chrome Sapphire", "Bowman Chrome", "Bowman Draft", "Bowman's Best", "Bowman Sterling",
  "Bowman Platinum", "Bowman Inception", "Bowman Transcendent", "Bowman", "Topps",
  // Basketball
  "Panini Prizm", "Prizm Draft Picks", "Prizm", "Donruss Optic", "Optic", "Donruss Elite", "Donruss", "Select",
  "Mosaic", "National Treasures", "Flawless", "Noir", "Obsidian", "Spectra", "Chronicles", "Revolution",
  "Court Kings", "Contenders Optic", "Contenders", "Hoops", "Crown Royale",
  "Upper Deck Exquisite", "SP Authentic", "Upper Deck", "Fleer Ultra", "Fleer", "Skybox",
  // Pokémon
  "Base Set 2", "Base Set", "Jungle", "Fossil", "Team Rocket", "Gym Heroes", "Gym Challenge", "Neo Genesis",
  "Neo Discovery", "Neo Revelation", "Neo Destiny", "Expedition", "Aquapolis", "Skyridge", "Evolving Skies",
  "Hidden Fates", "Shining Fates", "Celebrations", "Crown Zenith", "Brilliant Stars", "Astral Radiance", "Lost Origin",
  "Silver Tempest", "Fusion Strike", "Vivid Voltage", "Champion's Path", "Paldea Evolved", "Obsidian Flames",
  "Paradox Rift", "Paldean Fates", "Temporal Forces", "Twilight Masquerade", "Shrouded Fable", "Stellar Crown",
  "Surging Sparks", "Prismatic Evolutions", "Journey Together", "Destined Rivals", "Black Bolt", "White Flare", "151",
];
// Most specific first: "Bowman's Best" must win over "Bowman", "Obsidian Flames" over "Obsidian".
const SETS = [...SETS_RAW].sort((a, b) => b.length - a.length);
const setRegex = (s: string) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]?")}(?![\\w'’])`, "i");

const PARALLELS = [
  "Silver Prizm", "Gold Prizm", "Black Prizm", "Red Prizm", "Blue Prizm", "Green Prizm", "Purple Prizm",
  "Gold Refractor", "Orange Refractor", "Blue Refractor", "Green Refractor", "Red Refractor", "Purple Refractor",
  "Black Refractor", "Superfractor", "X-Fractor", "Xfractor", "Prism Refractor", "Refractor", "Silver",
  "Gold", "1st Edition Holo", "Reverse Holo", "Holo", "Shadowless",
];

const KNOWN_PLAYERS = [
  ...Object.keys(DEMAND_TIERS),
  "Kobe Bryant", "Stephen Curry", "Giannis Antetokounmpo", "Anthony Edwards", "Ken Griffey Jr", "Derek Jeter",
  "Aaron Judge", "Juan Soto", "Mickey Mantle", "Pikachu", "Mewtwo", "Umbreon", "Rayquaza", "Lugia", "Blastoise",
  "Venusaur", "Gengar",
];

const ci = (s: string) => s.toLowerCase();

function aspect(aspects: Aspect[], ...names: string[]): string | null {
  for (const n of names) {
    const hit = aspects.find((a) => ci(a.name) === ci(n));
    if (hit && hit.value && !/^(n\/a|none|unknown|does not apply|-)$/i.test(hit.value.trim())) return hit.value.trim();
  }
  return null;
}

function sportFrom(text: string): Sport | null {
  const t = ci(text);
  if (/basketball|\bnba\b/.test(t)) return "NBA";
  if (/baseball|\bmlb\b/.test(t)) return "MLB";
  if (/pok[eé]mon/.test(t)) return "Pokemon";
  return null;
}

/**
 * Search results only include the title (no item specifics), and titles rarely
 * say "baseball". A known player or an unambiguous team name settles the sport.
 */
const PLAYER_SPORT: Record<string, Sport> = {
  "shohei ohtani": "MLB", "mike trout": "MLB", "ken griffey jr": "MLB", "derek jeter": "MLB", "aaron judge": "MLB",
  "juan soto": "MLB", "mickey mantle": "MLB",
  "michael jordan": "NBA", "lebron james": "NBA", "luka doncic": "NBA", "victor wembanyama": "NBA", "kobe bryant": "NBA",
  "stephen curry": "NBA", "giannis antetokounmpo": "NBA", "anthony edwards": "NBA",
  charizard: "Pokemon", pikachu: "Pokemon", mewtwo: "Pokemon", umbreon: "Pokemon", rayquaza: "Pokemon", lugia: "Pokemon",
  blastoise: "Pokemon", venusaur: "Pokemon", gengar: "Pokemon",
};
const MLB_TEAMS = /\b(angels|dodgers|yankees|red sox|mariners|orioles|blue jays|astros|braves|padres|cubs|white sox|mets|phillies|brewers|guardians|tigers|twins|royals|athletics|marlins|nationals|pirates|reds|rockies|diamondbacks|rays)\b/;
const NBA_TEAMS = /\b(bulls|lakers|celtics|warriors|mavericks|spurs|knicks|heat|bucks|timberwolves|nuggets|suns|76ers|sixers|raptors|clippers|rockets|thunder|grizzlies|pelicans|hornets|pistons|pacers|cavaliers|hawks|magic|wizards|trail blazers|jazz|nets)\b/;

function plain(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sportFromPlayerOrTeam(player: string | undefined, title: string): Sport | null {
  if (player) {
    const s = PLAYER_SPORT[plain(player).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim()];
    if (s) return s;
  }
  const t = plain(title);
  const mlb = MLB_TEAMS.test(t);
  const nba = NBA_TEAMS.test(t);
  if (mlb !== nba) return mlb ? "MLB" : "NBA"; // only when exactly one sport's team is named
  return null;
}

export function cardFromListing(title: string, aspects: Aspect[] = []): CardSuggestion {
  const card: Partial<CardIdentity> = {};
  const sources: CardSuggestion["sources"] = {};
  const set = <K extends keyof CardIdentity>(k: K, v: CardIdentity[K], from: "item specifics" | "title") => {
    card[k] = v;
    sources[k] = from;
  };

  // Sport / game
  const sportAspect = aspect(aspects, "Sport", "Game", "League");
  const sport = (sportAspect && sportFrom(sportAspect)) || sportFrom(title);
  if (sport) set("sport", sport, sportAspect && sportFrom(sportAspect) ? "item specifics" : "title");

  // Player / character
  const player = aspect(aspects, "Player/Athlete", "Player", "Athlete", "Character", "Card Name");
  if (player) set("player", player, "item specifics");
  else {
    const known = KNOWN_PLAYERS.find((p) => ci(title).includes(ci(p)));
    if (known) set("player", known, "title");
  }
  if (!card.sport) {
    const s = sportFromPlayerOrTeam(card.player, title);
    if (s) set("sport", s, "title");
  }

  // Year (season "2018-19" → 2018)
  const yearAspect = aspect(aspects, "Year Manufactured", "Season", "Year");
  const yearMatch = (yearAspect ?? "").match(/\b(18[89]\d|19\d\d|20[0-4]\d)\b/) ?? title.match(/\b(19[4-9]\d|20[0-4]\d)\b/);
  if (yearMatch) set("year", Number(yearMatch[1]), yearAspect && yearAspect.includes(yearMatch[1]) ? "item specifics" : "title");

  // Set
  const setAspect = aspect(aspects, "Set", "Set Name", "Product Line");
  if (setAspect) set("set", setAspect, "item specifics");
  else {
    const known = SETS.find((s) => setRegex(s).test(title));
    if (known) set("set", known, "title");
  }

  // Card number
  const numAspect = aspect(aspects, "Card Number");
  if (numAspect) set("cardNumber", numAspect.replace(/^#/, ""), "item specifics");
  else {
    const m = title.match(/#\s*([A-Z]{0,6}-?\d+[A-Z]?)\b/i) ?? (sport === "Pokemon" ? title.match(/\b(\d{1,3}\/\d{2,3})\b/) : null);
    if (m) set("cardNumber", m[1].toUpperCase(), "title");
  }

  // Parallel
  const parAspect = aspect(aspects, "Parallel/Variety", "Parallel", "Variety", "Finish");
  if (parAspect && !/^base$/i.test(parAspect)) set("parallel", parAspect, "item specifics");
  else {
    const known = PARALLELS.find((p) => new RegExp(`\\b${p}\\b`, "i").test(title));
    if (known) set("parallel", known, "title");
  }

  // Serial number (print run): "/99", "#'d /25", "12/50" — not for Pokémon, where X/Y is the card number.
  const runAspect = aspect(aspects, "Print Run");
  const runMatch = (runAspect ?? "").match(/(\d{1,5})/);
  if (runMatch) set("serialNumbered", Number(runMatch[1]), "item specifics");
  else if (sport !== "Pokemon") {
    const m = title.match(/(?:^|\s)(?:\d{1,4})?\/(\d{1,4})(?=\s|$)/);
    if (m) set("serialNumbered", Number(m[1]), "title");
  }

  // Rookie
  const features = aspect(aspects, "Features", "Card Attributes") ?? "";
  if (/rookie|\brc\b/i.test(features)) set("isRookie", true, "item specifics");
  else if (/\b(rc|rookie)\b/i.test(title)) set("isRookie", true, "title");

  // Grading company + grade
  const graderAspect = aspect(aspects, "Professional Grader", "Grader");
  const gradeAspect = aspect(aspects, "Grade");
  const graderFrom = (s: string): Grader | null => {
    const m = s.match(/\b(PSA|BGS|Beckett|SGC|CGC)\b/i);
    if (!m) return null;
    const g = m[1].toUpperCase();
    return g === "BECKETT" ? "BGS" : (g as Grader);
  };
  const titleGrade = title.match(/\b(PSA|BGS|SGC|CGC)\s*(10|[1-9](?:\.5)?)\b/i);
  if (graderAspect && graderFrom(graderAspect)) {
    set("grader", graderFrom(graderAspect) as Grader, "item specifics");
    const g = Number((gradeAspect ?? "").match(/(10|[1-9](?:\.5)?)/)?.[1]);
    if (g) set("grade", g, "item specifics");
    else if (titleGrade) set("grade", Number(titleGrade[2]), "title");
  } else if (titleGrade) {
    set("grader", titleGrade[1].toUpperCase() as Grader, "title");
    set("grade", Number(titleGrade[2]), "title");
  } else if (/ungraded|\braw\b/i.test(`${title} ${aspect(aspects, "Graded") ?? ""}`) || ci(aspect(aspects, "Graded") ?? "") === "no") {
    set("grader", "RAW", aspect(aspects, "Graded") ? "item specifics" : "title");
  }

  const required: [keyof CardIdentity, string][] = [
    ["sport", "category"],
    ["player", "player"],
    ["year", "year"],
    ["set", "set"],
    ["cardNumber", "card number"],
    ["grader", "grading company"],
  ];
  const missing = required.filter(([k]) => card[k] === undefined).map(([, label]) => label);
  if (card.grader && card.grader !== "RAW" && card.grade === undefined) missing.push("grade");

  return { card, missing, sources };
}
