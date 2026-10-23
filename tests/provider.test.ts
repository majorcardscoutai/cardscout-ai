import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, normNumber, parseApiProduct, pickProduct, priceFieldFor, priceFor, scoreProduct, siteFor, type ProviderProduct } from "../src/lib/provider.js";
import type { CardIdentity } from "../src/lib/types.js";

const ohtani: CardIdentity = { sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update", cardNumber: "US1", parallel: null, serialNumbered: null, variation: null, isRookie: true, grader: "PSA", grade: 10 };
const P = (id: string, name: string, consoleName: string, prices: Record<string, number> = { "manual-only-price": 40000, "graded-price": 15000, "loose-price": 2000 }): ProviderProduct => ({ id, productName: name, consoleName, prices, salesVolume: 120 });

test("query + site", () => {
  assert.equal(buildQuery(ohtani), "Shohei Ohtani 2018 Topps Update #us1");
  assert.equal(siteFor(ohtani), "sportscardspro");
  assert.equal(siteFor({ ...ohtani, sport: "Pokemon" }), "pricecharting");
  assert.equal(normNumber("199/165"), "199");
  assert.equal(normNumber("#FS-1"), "fs1");
});

test("matches only the exact card", () => {
  const base = P("1", "Shohei Ohtani #US1", "Baseball Cards 2018 Topps Update");
  assert.equal(scoreProduct(ohtani, base).ok, true);
  assert.equal(scoreProduct(ohtani, P("2", "Shohei Ohtani [Gold] #US1", "Baseball Cards 2018 Topps Update")).ok, false, "parallel ≠ base");
  assert.equal(scoreProduct(ohtani, P("3", "Shohei Ohtani #US2", "Baseball Cards 2018 Topps Update")).ok, false, "number");
  assert.equal(scoreProduct(ohtani, P("4", "Shohei Ohtani #US1", "Baseball Cards 2019 Topps Update")).ok, false, "year");
  assert.equal(scoreProduct(ohtani, P("5", "Mike Trout #US1", "Baseball Cards 2018 Topps Update")).ok, false, "player");
  assert.equal(scoreProduct(ohtani, P("6", "Shohei Ohtani #US1", "Basketball Cards 2018 Topps Update")).ok, false, "sport");
  assert.equal(scoreProduct(ohtani, P("7", "Shohei Ohtani #US1", "Baseball Cards 2018 Bowman")).ok, false, "set");
  const gold = { ...ohtani, parallel: "Gold" };
  assert.equal(scoreProduct(gold, P("2", "Shohei Ohtani [Gold] #US1", "Baseball Cards 2018 Topps Update")).ok, true);
  assert.equal(scoreProduct(gold, base).ok, false, "parallel wanted, base offered");
  const numbered = { ...gold, serialNumbered: 2018 };
  assert.equal(scoreProduct(numbered, P("8", "Shohei Ohtani [Gold] #US1", "Baseball Cards 2018 Topps Update")).ok, false, "print run unconfirmed");
});

test("picks the closest set; ambiguity means no value", () => {
  const exact = P("1", "Shohei Ohtani #US1", "Baseball Cards 2018 Topps Update");
  const wider = P("9", "Shohei Ohtani #US1", "Baseball Cards 2018 Topps Update Chrome");
  const r = pickProduct(ohtani, [wider, exact]);
  assert.ok(r.ok); if (r.ok) assert.equal(r.product.id, "1");
  const only = pickProduct(ohtani, [wider]);
  assert.equal(only.ok, false, "a different (wider) set is never used");
  const twin = P("10", "Shohei Ohtani #US1", "Baseball Cards 2018 Topps Update");
  const amb = pickProduct(ohtani, [exact, twin]);
  assert.equal(amb.ok, false); if (!amb.ok) assert.equal(amb.reason, "ambiguous");
  const none = pickProduct(ohtani, [P("2", "Shohei Ohtani [Gold] #US1", "Baseball Cards 2018 Topps Update")]);
  assert.equal(none.ok, false); if (!none.ok) assert.equal(none.reason, "no_match");
});

test("Pokémon: number before the slash, set from the console name", () => {
  const zard: CardIdentity = { ...ohtani, sport: "Pokemon", player: "Charizard ex", year: 2023, set: "151", cardNumber: "199/165" };
  assert.equal(scoreProduct(zard, P("z", "Charizard ex #199", "Pokemon Scarlet & Violet 151")).ok, true);
  assert.equal(scoreProduct(zard, P("y", "Charizard ex #6", "Pokemon Scarlet & Violet 151")).ok, false);
});

test("grade → price field", () => {
  assert.deepEqual(priceFieldFor(ohtani), { field: "manual-only-price", graderSpecific: true });
  assert.deepEqual(priceFieldFor({ ...ohtani, grader: "BGS", grade: 10 }), { field: "bgs-10-price", graderSpecific: true });
  assert.deepEqual(priceFieldFor({ ...ohtani, grader: "CGC", grade: 10 }), { field: "condition-17-price", graderSpecific: true });
  assert.deepEqual(priceFieldFor({ ...ohtani, grader: "SGC", grade: 10 }), { field: "condition-18-price", graderSpecific: true });
  assert.deepEqual(priceFieldFor({ ...ohtani, grade: 9 }), { field: "graded-price", graderSpecific: false });
  assert.deepEqual(priceFieldFor({ ...ohtani, grader: "BGS", grade: 9.5 }), { field: "box-only-price", graderSpecific: false });
  assert.deepEqual(priceFieldFor({ ...ohtani, grade: 8.5 }), { field: "new-price", graderSpecific: false });
  assert.deepEqual(priceFieldFor({ ...ohtani, grader: "RAW", grade: null }), { field: "loose-price", graderSpecific: true });
  assert.equal(priceFieldFor({ ...ohtani, grade: 6.5 }), null);
  const prod = P("1", "Shohei Ohtani #US1", "Baseball Cards 2018 Topps Update");
  assert.deepEqual(priceFor(ohtani, prod), { usd: 400, field: "manual-only-price", graderSpecific: true });
  assert.equal(priceFor({ ...ohtani, grader: "BGS", grade: 10 }, prod), null, "no BGS 10 price → no value");
});

test("parses API products (pennies, strings, ignores retail fields)", () => {
  const p = parseApiProduct({ id: 6910, "product-name": "Shohei Ohtani #US1", "console-name": "Baseball Cards 2018 Topps Update", "manual-only-price": 40123, "graded-price": "15000", "retail-loose-buy": 100, "retail-new-sell": 5, "sales-volume": "321" });
  assert.ok(p);
  assert.equal(p!.id, "6910");
  assert.deepEqual(p!.prices, { "manual-only-price": 40123, "graded-price": 15000 });
  assert.equal(p!.salesVolume, 321);
  assert.equal(parseApiProduct({ nope: 1 }), null);
});

test("Bowman vs Bowman's Best; Panini is ignored; Japanese Pokémon is a different product", async () => {
  const { cardFromListing } = await import("../src/lib/ebay/parse.js");
  const best = cardFromListing("156741084 Shohei Ohtani 2024 Bowman's Best #33 Refractor PSA 10").card;
  assert.equal(best.set, "Bowman's Best");
  assert.equal(cardFromListing("2024 Bowmans Best Shohei Ohtani #33 PSA 10").card.set, "Bowman's Best");
  assert.equal(cardFromListing("2024 BOWMAN #33 SHOHEI OHTANI PSA 10").card.set, "Bowman");
  assert.equal(cardFromListing("2023 Pokemon Obsidian Flames Charizard ex #223 PSA 10").card.set, "Obsidian Flames");
  assert.equal(cardFromListing("Devin Booker 2015 Panini Prizm Phoenix Suns #138 PSA 10").card.set, "Panini Prizm");
  const bowman: CardIdentity = { ...ohtani, year: 2024, set: "Bowman", cardNumber: "33", isRookie: false };
  assert.equal(scoreProduct(bowman, P("b", "Shohei Ohtani #33", "Baseball Cards 2024 Bowman")).ok, true);
  assert.equal(scoreProduct(bowman, P("bb", "Shohei Ohtani #33", "Baseball Cards 2024 Bowman's Best")).ok, false);
  assert.equal(scoreProduct({ ...bowman, set: "Bowman's Best" }, P("bb", "Shohei Ohtani #33", "Baseball Cards 2024 Bowman's Best")).ok, true);
  const booker: CardIdentity = { ...ohtani, sport: "NBA", player: "Devin Booker", year: 2015, set: "Panini Prizm", cardNumber: "138" };
  assert.equal(scoreProduct(booker, P("k", "Devin Booker #138", "Basketball Cards 2015 Panini Prizm")).ok, true);
  assert.equal(scoreProduct({ ...booker, set: "Prizm" }, P("k", "Devin Booker #138", "Basketball Cards 2015 Panini Prizm")).ok, true);
  const zard: CardIdentity = { ...ohtani, sport: "Pokemon", player: "Charizard ex", year: 2023, set: "151", cardNumber: "199/165" };
  assert.equal(scoreProduct(zard, P("j", "Charizard ex #199", "Pokemon Japanese 151")).ok, false);
});

test("apostrophes don't matter; no-match explains the closest products", () => {
  const best: CardIdentity = { ...ohtani, year: 2024, set: "Bowman's Best", cardNumber: "33", parallel: "Refractor", isRookie: false };
  assert.equal(scoreProduct(best, P("a", "Shohei Ohtani [Refractor] #33", "Baseball Cards 2024 Bowmans Best")).ok, true);
  assert.equal(scoreProduct(best, P("a", "Shohei Ohtani [Refractor] #33", "Baseball Cards 2024 Bowman's Best")).ok, true);
  const r = pickProduct(best, [P("c", "Shohei Ohtani [Refractor] #33", "Baseball Cards 2024 Bowman Chrome"), P("d", "Mike Trout #33", "Baseball Cards 2024 Bowman's Best")]);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.detail, /Closest in the guide: Shohei Ohtani \[Refractor\] #33 · Baseball Cards 2024 Bowman Chrome \(different set\)/); }
  const none = pickProduct(best, []);
  if (!none.ok) assert.match(none.detail, /found nothing/);
});

test("parallels must match exactly; Pokémon sets, reverse holo, 1st Edition", async () => {
  const { cardFromListing } = await import("../src/lib/ebay/parse.js");
  const refr: CardIdentity = { ...ohtani, set: "Topps Chrome", cardNumber: "BCP-1", parallel: "Refractor" };
  assert.equal(scoreProduct(refr, P("r", "Shohei Ohtani [Refractor] #BCP-1", "Baseball Cards 2018 Topps Chrome")).ok, true);
  assert.equal(scoreProduct(refr, P("g", "Shohei Ohtani [Gold Refractor] #BCP-1", "Baseball Cards 2018 Topps Chrome")).ok, false, "Refractor ≠ Gold Refractor");
  assert.equal(scoreProduct({ ...refr, parallel: "Gold Refractor", serialNumbered: 50 }, P("g", "Shohei Ohtani [Gold Refractor /50] #BCP-1", "Baseball Cards 2018 Topps Chrome")).ok, true);
  const read = (t: string) => cardFromListing(t).card;
  assert.equal(read("2023 Topps Chrome Jackson Holliday #BCP-1 Emerald Refractor PSA 10").parallel, "Emerald Refractor");
  let c = read("Charizard EX #12 PSA 9 Holo Graded 2016 Pokémon XY Evolutions English");
  assert.equal(c.set, "Evolutions"); assert.equal(c.parallel, undefined); assert.equal(c.cardNumber, "12");
  c = read("2016 Pokemon Xy Evolutions #11 Charizard-Rev.Foil Evolutions PSA 7");
  assert.equal(c.parallel, "Reverse Holo"); assert.equal(c.cardNumber, "11");
  c = read("1999 Pokemon Base Set 1st Edition Holo Charizard 4/102 PSA 9");
  assert.equal(c.set, "Base Set"); assert.equal(c.parallel, "1st Edition");
  const zard = { ...ohtani, sport: "Pokemon", player: "Charizard", year: 2016, set: "Evolutions", cardNumber: "11", parallel: "Reverse Holo" } as CardIdentity;
  assert.equal(scoreProduct(zard, P("z", "Charizard [Reverse Holo] #11", "Pokemon Evolutions")).ok, true);
  assert.equal(scoreProduct(zard, P("z2", "Charizard #11", "Pokemon Evolutions")).ok, false, "reverse holo never priced as the regular card");
  assert.equal(read("2023 Topps Chrome Football CJ Stroud #200 PSA 10").sport, undefined, "football is not covered");
});

test("set-name fallback: guide card's player AND set must be in the title", async () => {
  const { matchBySetInTitle, consoleSet } = await import("../src/lib/provider.js");
  assert.equal(consoleSet("Baseball Cards 2018 Topps Chrome Update"), "Topps Chrome Update");
  assert.equal(consoleSet("Basketball Cards 2020-21 Panini Prizm"), "Panini Prizm");
  assert.equal(consoleSet("Pokemon Evolutions"), "Evolutions");
  const trout = { sport: "MLB", player: "Lineage Mike Trout", year: 2011, cardNumber: "US175", grader: "PSA", grade: 10 } as Partial<CardIdentity>;
  const title = "2011 Topps Lineage Mike Trout #US175 PSA 10 RC";
  const upd = P("u", "Mike Trout #US175", "Baseball Cards 2011 Topps Update");
  const lin = P("l", "Mike Trout #US175", "Baseball Cards 2011 Topps Lineage");
  const r = matchBySetInTitle(trout, title, [upd, lin]);
  assert.ok(r.ok); if (r.ok) { assert.equal(r.product.id, "l"); assert.equal(r.set, "Topps Lineage"); assert.equal(r.player, "Mike Trout"); }
  assert.equal(matchBySetInTitle(trout, title, [upd]).ok, false, "set not in the title → no value");
  assert.equal(matchBySetInTitle(trout, title, [P("x", "Mike Trout [Gold] #US175", "Baseball Cards 2011 Topps Lineage")]).ok, false, "parallel must match");
  assert.equal(matchBySetInTitle(trout, title, [P("y", "Bryce Harper #US175", "Baseball Cards 2011 Topps Lineage")]).ok, false, "player must be in the title");
  assert.equal(matchBySetInTitle({ ...trout, year: 2012 }, title, [lin]).ok, false, "year must match");
  const chromeUpd = P("cu", "Shohei Ohtani #HMT1", "Baseball Cards 2018 Topps Chrome Update");
  const plainUpd = P("pu", "Shohei Ohtani #HMT1", "Baseball Cards 2018 Topps Update");
  const r2 = matchBySetInTitle({ sport: "MLB", player: "Shohei Ohtani", year: 2018, cardNumber: "HMT1", grader: "PSA", grade: 10 }, "2018 Topps Chrome Update Shohei Ohtani HMT1 PSA 10", [plainUpd, chromeUpd]);
  assert.ok(r2.ok); if (r2.ok) assert.equal(r2.product.id, "cu", "most specific set wins");
  const twins = matchBySetInTitle(trout, title, [lin, P("l2", "Mike Trout #US175", "Baseball Cards 2011 Topps Lineage")]);
  assert.equal(twins.ok, false, "two equally good → no value");
});

test("one lookup prices every grade of the same card", async () => {
  const { sameCardKey } = await import("../src/lib/provider.js");
  assert.equal(sameCardKey("mlb|shohei ohtani|2018|topps update|us1||||psa|10"), sameCardKey("mlb|shohei ohtani|2018|topps update|us1||||psa|9"));
  assert.notEqual(sameCardKey("mlb|shohei ohtani|2018|topps update|us1|gold|||psa|10"), sameCardKey("mlb|shohei ohtani|2018|topps update|us1||||psa|10"));
});

test("naming quirks: Blue Refractor = [Blue], #83-2, unwritten print runs, Satchel/Satchell, T206", async () => {
  const { cardFromListing } = await import("../src/lib/ebay/parse.js");
  const judge: CardIdentity = { ...ohtani, player: "Aaron Judge", year: 2017, set: "Topps Chrome", cardNumber: "169", parallel: "Blue Refractor", serialNumbered: 150, grader: "BGS", grade: 9.5 };
  const chrome = (id: string, br: string) => P(id, `Aaron Judge [${br}] #169`, "Baseball Cards 2017 Topps Chrome");
  const r = pickProduct(judge, [chrome("b", "Blue"), chrome("r", "Refractor"), chrome("w", "Blue Wave")]);
  assert.ok(r.ok); if (r.ok) assert.equal(r.product.id, "b");
  assert.equal(pickProduct({ ...judge, parallel: "Refractor", serialNumbered: null }, [chrome("b", "Blue"), chrome("w", "Blue Wave")]).ok, false, "plain Refractor never matches Blue");
  assert.equal(pickProduct(judge, [chrome("b", "Blue"), chrome("b2", "Blue")]).ok, false, "unwritten print run only when exactly one fits");
  assert.equal(pickProduct(judge, [chrome("b", "Blue /99")]).ok, false, "a different written print run never matches");
  const c = cardFromListing("2018 Topps Update Shohei Ohtani 1983 Rookie RC GOLD /50 #83-2 Angels PSA 9 Mint").card;
  assert.equal(c.cardNumber, "83-2");
  assert.equal(cardFromListing("1909 T206 Lenox Black Back PSA 3 Larry Doyle", [], { sport: "MLB" }).card.cardNumber, undefined, "T206 is a set, not a number");
  const paige: CardIdentity = { ...ohtani, player: "Satchel Paige", year: 1949, set: "Bowman", cardNumber: "224", grade: 6, isRookie: true };
  assert.equal(scoreProduct(paige, P("p", "Satchell Paige #224", "Baseball Cards 1949 Bowman")).ok, true);
  assert.equal(scoreProduct(paige, P("q", "Satchel Page #224", "Baseball Cards 1949 Bowman")).ok, false, "surname must match exactly");
  assert.equal(scoreProduct({ ...paige, player: "Mike Trout" }, P("t", "Mark Trout #224", "Baseball Cards 1949 Bowman")).ok, false, "short first names must match exactly");
});

test("wrong Top Deals (23 Oct): variations, stamped cards, qualified grades, non-PSA 7–9.5", async () => {
  const { cardFromListing, qualifiedGradeInTitle, variationInTitle } = await import("../src/lib/ebay/parse.js");
  const { dealGradeValue, usableValue } = await import("../src/lib/scan.js");
  // Kobe 1957-58 Variation Xfractor ≠ the regular Xfractor #24
  const kobe: CardIdentity = { ...ohtani, sport: "NBA", player: "Kobe Bryant", year: 2007, set: "Topps Chrome", cardNumber: "24", parallel: "Xfractor", serialNumbered: null, grader: "PSA", grade: 9, isRookie: false };
  const reg = P("r", "Kobe Bryant [Xfractor] #24", "Basketball Cards 2007 Topps Chrome");
  const varP = P("v", "Kobe Bryant [1957-58 Variation Xfractor] #24", "Basketball Cards 2007 Topps Chrome");
  const c = cardFromListing("2007 Topps Chrome 1957-58 Variation Xfractor #24 Kobe Bryant /50 PSA 9").card;
  assert.equal(c.variation, "Variation");
  assert.equal(scoreProduct({ ...kobe, variation: "Variation" }, reg).ok, false, "variation listing ≠ regular card");
  assert.equal(scoreProduct({ ...kobe, variation: "Variation" }, varP).ok, true);
  assert.equal(scoreProduct(kobe, varP).ok, false, "regular listing ≠ variation card");
  assert.equal(scoreProduct(kobe, reg).ok, true);
  // Pokémon stamped
  assert.equal(variationInTitle("CGC 9 MINT Charizard 4/100 EX Crystal Guardians Reverse Holo Stamped Pokemon"), "Stamped");
  assert.equal(variationInTitle("2018 Topps Update Shohei Ohtani RC #US1 PSA 10"), null);
  // qualified grades
  assert.equal(qualifiedGradeInTitle("1964 Topps #50 Mickey Mantle PSA NM-MT 8 (OC) 02463270"), true);
  assert.equal(qualifiedGradeInTitle("1955 Topps Koufax PSA 6 ST"), true);
  assert.equal(qualifiedGradeInTitle("1955 Topps #123 Sandy Koufax PSA EX-MT 6 11217103"), false);
  assert.equal(cardFromListing("1964 Topps #50 Mickey Mantle PSA 8 (OC)").card.grade, undefined);
  assert.match(cardFromListing("1964 Topps #50 Mickey Mantle PSA 8 (OC)").missing.join(), /qualified grade/);
  const auto = { source: "sportscardspro" as const, graderSpecific: true };
  assert.equal(usableValue(auto, "1964 Topps Mantle PSA NM-MT 8 (OC)", "mlb|mickey mantle|1964|topps|50||||psa|8"), null);
  assert.equal(usableValue({ source: "you" as const }, "1964 Topps Mantle PSA NM-MT 8 (OC)", "k")?.source, "you", "your own values stand");
  assert.equal(usableValue(auto, "Kobe 1957-58 Variation Xfractor", "nba|kobe bryant|2007|topps chrome|24|xfractor|||psa|9"), null, "stored key without the variation");
  assert.ok(usableValue(auto, "Kobe 1957-58 Variation Xfractor", "nba|kobe bryant|2007|topps chrome|24|xfractor||variation|psa|9"));
  // BGS / CGC / SGC 9s on the any-company grade price: shown, never a deal
  const any = { source: "sportscardspro" as const, graderSpecific: false };
  assert.equal(dealGradeValue(any, "nba|shaquille oneal|1997|metal universe|4|platinum portraits|||bgs|9"), false);
  assert.equal(dealGradeValue(any, "mlb|sandy koufax|1955|topps|123||||psa|6"), true);
  assert.equal(dealGradeValue({ source: "sportscardspro", graderSpecific: true }, "x|||||||cgc|10"), true, "grader-specific 10s count");
  assert.equal(dealGradeValue({ source: "you" }, "x|||||||bgs|9"), true);
});
