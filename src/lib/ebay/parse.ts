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

const SPORTS_SETS = [
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
];

/** English Pokémon sets (oldest → newest). Only used for Pokémon titles. */
const POKEMON_SETS = [
  "Base Set 2", "Base Set", "Jungle", "Fossil", "Team Rocket", "Gym Heroes", "Gym Challenge", "Neo Genesis",
  "Neo Discovery", "Neo Revelation", "Neo Destiny", "Legendary Collection", "Expedition", "Aquapolis", "Skyridge",
  "EX Ruby & Sapphire", "Sandstorm", "Team Magma vs Team Aqua", "Hidden Legends", "FireRed & LeafGreen",
  "Team Rocket Returns", "Unseen Forces", "Delta Species", "Legend Maker", "Holon Phantoms", "Crystal Guardians",
  "Dragon Frontiers", "Power Keepers", "Mysterious Treasures", "Secret Wonders", "Great Encounters", "Majestic Dawn",
  "Legends Awakened", "Stormfront", "Rising Rivals", "Supreme Victors", "HeartGold SoulSilver", "Unleashed",
  "Undaunted", "Triumphant", "Call of Legends", "Emerging Powers", "Noble Victories", "Next Destinies",
  "Dark Explorers", "Dragons Exalted", "Dragon Vault", "Boundaries Crossed", "Plasma Storm", "Plasma Freeze",
  "Plasma Blast", "Legendary Treasures", "Flashfire", "Furious Fists", "Phantom Forces", "Primal Clash",
  "Double Crisis", "Roaring Skies", "Ancient Origins", "BREAKthrough", "BREAKpoint", "Generations", "Fates Collide",
  "Steam Siege", "Evolutions", "Guardians Rising", "Burning Shadows", "Shining Legends", "Crimson Invasion",
  "Ultra Prism", "Forbidden Light", "Celestial Storm", "Dragon Majesty", "Lost Thunder", "Team Up",
  "Detective Pikachu", "Unbroken Bonds", "Unified Minds", "Hidden Fates", "Cosmic Eclipse", "Rebel Clash",
  "Darkness Ablaze", "Champion's Path", "Vivid Voltage", "Shining Fates", "Battle Styles", "Chilling Reign",
  "Evolving Skies", "Celebrations", "Fusion Strike", "Brilliant Stars", "Astral Radiance", "Pokemon GO",
  "Lost Origin", "Silver Tempest", "Crown Zenith", "Paldea Evolved", "Obsidian Flames", "151", "Paradox Rift",
  "Paldean Fates", "Temporal Forces", "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Surging Sparks",
  "Prismatic Evolutions", "Journey Together", "Destined Rivals", "Black Bolt", "White Flare", "Mega Evolution",
  "Phantasmal Flames",
  // Other spellings, read as the set the guide uses (POKEMON_SET_ALIASES).
  "Base Set II", "Base II", "Base 2",
  // Series names — only used when no more specific set is in the title (see POKEMON_SERIES).
  "Scarlet & Violet", "Scarlet and Violet", "Sword & Shield", "Sword and Shield", "Sun & Moon", "Sun and Moon",
  "Black & White", "Black and White", "Diamond & Pearl", "Diamond and Pearl", "XY", "Platinum",
];
/** Other ways sellers (and PSA labels) write a set → the name the price guide uses. */
const POKEMON_SET_ALIASES: Record<string, string> = { "Base Set II": "Base Set 2", "Base II": "Base Set 2", "Base 2": "Base Set 2" };
/** Series names: "Scarlet & Violet 151" is the 151 set; "XY Evolutions" is Evolutions. */
const POKEMON_SERIES = new Set([
  "Scarlet & Violet", "Scarlet and Violet", "Sword & Shield", "Sword and Shield", "Sun & Moon", "Sun and Moon",
  "Black & White", "Black and White", "Diamond & Pearl", "Diamond and Pearl", "XY", "Platinum",
]);
// Most specific first: "Bowman's Best" must win over "Bowman", "Obsidian Flames" over "Obsidian".
const byLength = (a: string, b: string) => b.length - a.length;
const SETS_FOR: Record<"sports" | "pokemon" | "any", string[]> = {
  sports: [...SPORTS_SETS].sort(byLength),
  pokemon: [...POKEMON_SETS].sort(byLength),
  any: [...SPORTS_SETS, ...POKEMON_SETS].sort(byLength),
};
/** The set named in a title (most specific first), as the price guide spells it. Used for sealed products too. */
export function setInTitle(title: string, sport: Sport | null | undefined): string | null {
  const list = sport === "Pokemon" ? SETS_FOR.pokemon : sport === "MLB" || sport === "NBA" ? SETS_FOR.sports : SETS_FOR.any;
  const found = list.filter((s) => setRegex(s).test(title));
  const known = found.find((s) => !POKEMON_SERIES.has(s)) ?? found[0];
  return known ? (POKEMON_SET_ALIASES[known] ?? known) : null;
}
const setRegex = (s: string) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]?")}(?![\\w'’])`, "i");

const COLOUR_PARALLEL =
  /\b(?:sky blue|neon green|gold|orange|red|blue|green|purple|pink|black|aqua|teal|emerald|sapphire|yellow|silver|sepia|magenta|fuchsia|bronze|copper|ruby|negative|camo|white|rose gold)(?:\s+(?:wave|shimmer|mojo|speckle|sparkle|lava|ice|cracked ice|hyper|disco|mini diamond|geometric|scope|atomic|pulsar|velocity))?\s+(?:refractor|prizm|shimmer|wave|mojo|lava|ice|speckle|sparkle|xfractor|x-fractor)\b/i;

/** Item-specific values that mean "no parallel". */
export const BASE_WORDS = /^(base|base set|base card|base cards|none|n\/a|na|no|standard|regular|not applicable|-)$/i;

const PARALLELS = [
  "Silver Prizm", "Gold Prizm", "Black Prizm", "Red Prizm", "Blue Prizm", "Green Prizm", "Purple Prizm",
  "Gold Refractor", "Orange Refractor", "Blue Refractor", "Green Refractor", "Red Refractor", "Purple Refractor",
  "Black Refractor", "Superfractor", "X-Fractor", "Xfractor", "Prism Refractor", "Refractor", "Silver",
  "Gold", "1st Edition Holo", "1st Edition", "Reverse Holo", "Holo", "Shadowless",
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

/** Words that are never part of a player/character name in a listing title. */
const NAME_STOP = new Set(
  (
    "rc rookie rookies card cards gem mint mt nm near psa bgs sgc cgc beckett graded grade slab slabbed baseball basketball mlb nba football nfl soccer hockey nhl " +
    "pokemon pokémon tcg english japanese korean chinese holo reverse foil full art secret rare ultra illustration special promo first edition " +
    "base set sp ssp short print insert inserts parallel variation var variant image photo case hit hits sharp centered pop low invest hot hof mvp " +
    "all star allstar debut logo lot lots read new the and of w with x game used numbered limited team usa world champion champions award league " +
    "leaders future stars legends legend retro vintage classic collection nice look wow free shipping ship fast quality beautiful perfect rated " +
    "topps bowman panini donruss prizm chrome update select optic mosaic finest heritage stadium club series draft prospect prospects sapphire " +
    "fleer upper deck hoops contenders chronicles spectra obsidian noir flawless national treasures immaculate revolution court kings crown royale " +
    "phoenix origins absolute prestige score leaf skybox exquisite authentic certified elite status gypsy queen archives tribute inception dynasty " +
    "museum allen ginter big opening day holiday living now fire pristine sterling platinum transcendent tier one five triple threads definitive " +
    "black gold silver red blue green orange purple pink yellow white teal aqua bronze copper ruby emerald sky wave shimmer mojo speckle sparkle " +
    "refractor refractors xfractor superfractor prizms ice cracked atomic laser scope disco hyper camo tie dye zebra tiger snakeskin choice " +
    "auto autos autograph autographs autographed signed sig signature patch relic jersey rpa memorabilia swatch on card sticker " +
    "angels dodgers yankees sox mariners orioles jays astros braves padres cubs mets phillies brewers guardians tigers twins royals athletics " +
    "marlins nationals pirates reds rockies diamondbacks rays rangers giants cardinals indians expos " +
    "bulls lakers celtics warriors mavericks mavs spurs knicks heat bucks timberwolves wolves nuggets suns sixers 76ers raptors clippers rockets " +
    "thunder grizzlies pelicans hornets pistons pacers cavaliers cavs hawks magic wizards blazers trail jazz nets supersonics sonics " +
    "los angeles new york san francisco diego boston chicago miami dallas houston atlanta seattle toronto detroit cleveland philadelphia " +
    "milwaukee minnesota denver phoenix utah orlando memphis charlotte indiana sacramento golden state oklahoma city portland brooklyn washington " +
    "texas arizona colorado tampa bay kansas pittsburgh cincinnati baltimore oakland st louis montreal " +
    "sgc10 psa10 bgs10 cgc10 gem10 pristine10 bgs9 psa9 mint9 tag ksa hga isa csg ags rookie-card yr year no #"
  ).split(" "),
);
const NAME_SUFFIX = /^(jr|jr\.|sr|sr\.|ii|iii|iv)$/i;
const POKEMON_SUFFIX = /^(ex|gx|v|vmax|vstar|lv\.?x|break|prime|legend|star|δ)$/i;

/**
 * Best guess at the player/character when the title doesn't name a player we know:
 * strip years, numbers, grades, set/brand/parallel/team words, then take the first run of name-like words.
 * Safe because a value is only used when the price guide has the SAME player + year + set + number.
 */
export function guessPlayer(title: string, sport: Sport | undefined, remove: string[] = []): string | null {
  let t = ` ${title} `;
  for (const r of remove) if (r) t = t.replace(new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  t = t
    .replace(/#\s*\S+/g, " ")
    .replace(/\b(PSA|BGS|SGC|CGC|BECKETT)\s*\d+(\.5)?\b/gi, " ")
    .replace(/\d+(st|nd|rd|th)?\b/gi, " ")
    .replace(/[^\p{L}'’.\- ]+/gu, " ");
  const words = t.split(/\s+/).filter((w) => w && !/^[A-Za-z]{1,4}-$/.test(w));
  const nameLike = (w: string) => /^\p{L}[\p{L}'’.\-]*$/u.test(w) && !NAME_STOP.has(w.toLowerCase().replace(/[.’']/g, "")) && w.replace(/[.\-'’]/g, "").length >= 2;
  const minRun = sport === "Pokemon" ? 1 : 2;
  for (let i = 0; i < words.length; i++) {
    if (!nameLike(words[i])) continue;
    const run: string[] = [];
    let j = i;
    while (j < words.length && run.length < (sport === "Pokemon" ? 2 : 4) && nameLike(words[j])) run.push(words[j++]);
    if (j < words.length && (sport === "Pokemon" ? POKEMON_SUFFIX : NAME_SUFFIX).test(words[j])) run.push(words[j]);
    if (run.length >= minRun) {
      return run
        .map((w) => (POKEMON_SUFFIX.test(w) && sport === "Pokemon" ? w.toLowerCase() === "ex" ? "ex" : w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");
    }
    i = j;
  }
  return null;
}

/** "Variation" / "Stamped" named in a title (a different card from the regular one with that number). */
export function variationInTitle(title: string): "Variation" | "Stamped" | null {
  const m = title.match(/\b(image variation|photo variation|variation|var\.?|stamped|stamp)(?=\s|$|[^a-z])/i);
  return m ? (/stamp/i.test(m[1]) ? "Stamped" : "Variation") : null;
}

/** A qualified grade ("PSA 8 (OC)", "9 ST") — sells well below the plain grade; the guide has no price for it. */
export function qualifiedGradeInTitle(title: string): boolean {
  // OC in any case ("PSA 6 Oc"); the other codes only in capitals, so "9 St Louis" isn't read as a qualifier.
  return /\(\s*(OC|ST|PD|OF|MC|MK)\s*\)/.test(title) || /\b(10|[1-9](?:\.5)?)\s*(OC|ST|PD|OF|MC|MK)\b/.test(title) ||
    /\(\s*oc\s*\)/i.test(title) || /\b(10|[1-9](?:\.5)?)\s*oc\b/i.test(title);
}

/**
 * "OC" (off-centre) anywhere in the title, or "off center/centre". Off-centre cards usually sell below the
 * guide price for their grade, so the value is shown with a warning.
 */
export function offCentreInTitle(title: string): boolean {
  return /(?<![A-Za-z0-9])\(?oc\)?(?![A-Za-z0-9])/i.test(title) || /\boff[- ]?cent(?:er|re)(?:e?d)?\b/i.test(title);
}

const CARD_LANGUAGES: [RegExp, string][] = [
  [/\b(japanese|japan|jpn|jp|jap)\b/i, "Japanese"],
  [/\b(korean|kor)\b/i, "Korean"],
  [/\b(chinese|s-chinese|t-chinese|simplified chinese|traditional chinese)\b/i, "Chinese"],
  [/\b(german|deutsch|deutsche)\b/i, "German"],
  [/\b(french|fran[cç]ais|francaise)\b/i, "French"],
  [/\b(italian|italiano|italiana)\b/i, "Italian"],
  [/\b(spanish|espa[nñ]ol|espanola)\b/i, "Spanish"],
  [/\b(portuguese|portugu[eê]s)\b/i, "Portuguese"],
  [/\b(dutch|nederlands)\b/i, "Dutch"],
  [/\b(thai|indonesian|russian|polish)\b/i, "Other language"],
];

/** The language a Pokémon card's title names, if it isn't English ("German", "Japanese"…). */
export function cardLanguageInTitle(title: string): string | null {
  if (/\benglish\b/i.test(title) && !/\bnot english\b/i.test(title)) return null;
  return CARD_LANGUAGES.find(([re]) => re.test(title))?.[1] ?? null;
}

export function cardFromListing(title: string, aspects: Aspect[] = [], hint: { sport?: Sport } = {}): CardSuggestion {
  const card: Partial<CardIdentity> = {};
  const sources: CardSuggestion["sources"] = {};
  const set = <K extends keyof CardIdentity>(k: K, v: CardIdentity[K], from: "item specifics" | "title") => {
    card[k] = v;
    sources[k] = from;
  };

  // Sport / game
  const sportAspect = aspect(aspects, "Sport", "Game", "League");
  // A sport-specific search (e.g. the Profit Hunter's Baseball search) settles the sport.
  let sport = (sportAspect && sportFrom(sportAspect)) || sportFrom(title) || hint.sport || null;
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
    if (s) {
      set("sport", s, "title");
      sport = s; // e.g. "Charizard" with no "Pokemon" in the title: read the set and "4/130" the Pokémon way
    }
  }

  // Year (season "2018-19" → 2018)
  const yearAspect = aspect(aspects, "Year Manufactured", "Season", "Year");
  const yearMatch = (yearAspect ?? "").match(/\b(18[89]\d|19\d\d|20[0-4]\d)\b/) ?? title.match(/\b(19[4-9]\d|20[0-4]\d)\b/);
  if (yearMatch) set("year", Number(yearMatch[1]), yearAspect && yearAspect.includes(yearMatch[1]) ? "item specifics" : "title");

  // Set
  const setAspect = aspect(aspects, "Set", "Set Name", "Product Line");
  if (setAspect) set("set", setAspect, "item specifics");
  else {
    const list = sport === "Pokemon" ? SETS_FOR.pokemon : sport === "MLB" || sport === "NBA" ? SETS_FOR.sports : SETS_FOR.any;
    const found = list.filter((s) => setRegex(s).test(title));
    // Prefer a specific set over a Pokémon series name when both appear.
    const known = found.find((s) => !POKEMON_SERIES.has(s)) ?? found[0];
    if (known) set("set", POKEMON_SET_ALIASES[known] ?? known, "title");
  }

  // Card number: "#US1", "No. 49", or a code like "US1" / "BDC-50" / "TC-3" (sports; capitals + digits)
  const numAspect = aspect(aspects, "Card Number");
  if (numAspect) set("cardNumber", numAspect.replace(/^#/, ""), "item specifics");
  else {
    const m =
      title.match(/#\s*([A-Z]{0,6}-?\d+(?:-\d+)?[A-Z]?)\b/i) ??
      title.match(/\bNo\.?\s*(\d{1,4}[A-Z]?)\b/i) ??
      (sport === "Pokemon"
        ? // "015/172", and gallery/subset numbers like "GG54/GG70", "TG17/TG30", "SV107/SV122".
          title.match(/\b((?:GG|TG|SV|RC|SH)?\d{1,3}\/(?:GG|TG|SV|RC|SH)?\d{2,3})\b/i)
        : title.match(/\b(?!(?:PSA|BGS|SGC|CGC|GEM|MT|NM|RC|SP|SSP|HOF|MVP|POP|LOT|QTY|GMA|HGA|TAG|KSA)-?\d)(?!(?:T2\d\d|E\d{2,3})\b)([A-Z]{1,4}-?\d{1,4}[A-Z]?)\b/));
    if (m) set("cardNumber", m[1].toUpperCase(), "title");
  }

  // Parallel
  const parAspect = aspect(aspects, "Parallel/Variety", "Parallel", "Variety", "Finish");
  if (parAspect && !BASE_WORDS.test(parAspect.trim())) set("parallel", parAspect, "item specifics");
  else {
    // "Rev Foil", "Rev. Holo", "Reverse Foil" = Reverse Holo (priced separately from the regular card).
    const reverse = /\brev(?:erse)?\.?\s*-?\s*(?:holo|foil)\b/i.test(title);
    // Colour + finish parallels ("Emerald Refractor", "Gold Wave Refractor", "Silver Prizm") are read in full.
    const colour = title.match(COLOUR_PARALLEL);
    const known = reverse
      ? "Reverse Holo"
      : colour
        ? colour[0].replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase())
        : PARALLELS.find((p) => new RegExp(`\\b${p}\\b`, "i").test(title));
    // In Pokémon titles plain "Holo" just describes the card (holo rares are the normal version).
    // The price guide calls it "1st Edition" (holo is the normal version).
    if (known && !(sport === "Pokemon" && known === "Holo")) set("parallel", sport === "Pokemon" && known === "1st Edition Holo" ? "1st Edition" : known, "title");
    // "Chrome" in a non-Chrome set (Topps Heritage Chrome, "Chrome-Pink Sparkle") is part of the parallel:
    // the guide lists those as "[Pink Sparkle Chrome]" / "[Chrome]", a different card from the base one.
    if (sport !== "Pokemon" && card.set && !/chrome/i.test(card.set) && /\bchrome\b/i.test(title) && !/\bchrome\b/i.test(card.parallel ?? ""))
      set("parallel", card.parallel ? `Chrome ${card.parallel}` : "Chrome", "title");
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
  // The title and eBay's item specifics name different grades ("PSA 6" vs Grade 8): don't guess which is right.
  let gradeConflict: string | null = null;
  // Also when only the grading company came from item specifics ("SGC 10" in the title, Professional Grader: PSA,
  // no Grade field) — otherwise the title's 10 would be priced as the other company's 10.
  if (titleGrade && (sources.grade === "item specifics" || sources.grader === "item specifics")) {
    const tg = Number(titleGrade[2]);
    const tGrader = titleGrade[1].toUpperCase();
    if (tg !== card.grade || tGrader !== card.grader) {
      gradeConflict =
        sources.grade === "item specifics"
          ? `${tGrader} ${tg} in the title, ${card.grader} ${card.grade} in eBay's details`
          : `${tGrader} ${tg} in the title, ${card.grader} in eBay's details`;
      delete card.grade;
      delete sources.grade;
    }
  }

  // Still no sport: Bowman / Topps flagship-style sets are baseball (the guide must still list it as baseball).
  if (!card.sport && card.set && !/football|nfl|soccer|hockey|nhl|wrestling|ufc|f1|racing/i.test(title)) {
    if (/^(bowman|topps|stadium club|allen & ginter|gypsy queen)/i.test(card.set)) set("sport", "MLB", "title");
    else if (/^(hoops|court kings)$/i.test(card.set)) set("sport", "NBA", "title");
  }
  // Player not named in item specifics or our list → best guess from the title (checked against the guide later).
  if (!card.player) {
    const g = guessPlayer(title, card.sport, [
      sources.set === "title" ? card.set ?? "" : "",
      sources.parallel === "title" ? card.parallel ?? "" : "",
      sources.cardNumber === "title" ? card.cardNumber ?? "" : "",
    ]);
    if (g) set("player", g, "title");
  }

  // Non-English Pokémon cards (Japanese, German…) are priced differently — no English guide price.
  if (card.sport === "Pokemon") {
    const lang = cardLanguageInTitle(title) ?? (aspect(aspects, "Language") && !/^english$/i.test(aspect(aspects, "Language")!.trim()) ? aspect(aspects, "Language") : null);
    if (lang) set("language", lang, "title");
  }

  // Variations and stamped cards are different cards with the same number.
  const variation = variationInTitle(title);
  if (variation) set("variation", variation, "title");

  // Qualified grades (PSA "8 (OC)", "9 ST"…) sell well below the plain grade, and the guide has no price for them.
  const qualified = qualifiedGradeInTitle(title) || /\b(OC|ST|PD|OF|MC|MK)\b|\bqualifier\b|off[- ]?cent(er|re)d?\b/i.test(gradeAspect ?? "");
  if (qualified && card.grader && card.grader !== "RAW") delete card.grade;

  const required: [keyof CardIdentity, string][] = [
    ["sport", "category"],
    ["player", "player"],
    ["year", "year"],
    ["set", "set"],
    ["cardNumber", "card number"],
    ["grader", "grading company"],
  ];
  const missing = required.filter(([k]) => card[k] === undefined && !(k === "year" && card.sport === "Pokemon")).map(([, label]) => label);
  if (card.language) missing.push(`${card.language} card — CardHawk only prices English cards for now`);
  if (card.grader && card.grader !== "RAW" && card.grade === undefined)
    missing.push(gradeConflict ? `grade (${gradeConflict})` : qualified ? "qualified grade (OC, ST…) — no guide price" : "grade");

  return { card, missing, sources };
}
