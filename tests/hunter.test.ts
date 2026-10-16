import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HUNTER, hunterSearchInput, liquidEnough, parseHunterForm, parseHunterSport } from "../src/lib/hunter.js";
import { buildSearchPath } from "../src/lib/ebay/client.js";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

test("hunter eBay search: graded, sport filter, price range, 200 newest", () => {
  const cfg = { ...DEFAULT_HUNTER, enabled: true, budget: 250, minPrice: 30 };
  const u = new URL("https://x" + buildSearchPath(hunterSearchInput("MLB", cfg)));
  assert.equal(u.searchParams.get("q"), "(PSA, BGS, SGC, CGC)");
  assert.equal(u.searchParams.get("category_ids"), "261328");
  assert.equal(u.searchParams.get("aspect_filter"), "categoryId:261328,Sport:{Baseball}");
  assert.equal(u.searchParams.get("filter"), "price:[30..250],priceCurrency:USD,buyingOptions:{FIXED_PRICE}");
  assert.equal(u.searchParams.get("limit"), "200");
  assert.equal(u.searchParams.get("sort"), "newlyListed");
  const nba = new URL("https://x" + buildSearchPath(hunterSearchInput("NBA", { ...cfg, includeAuctions: true, minPrice: 0 })));
  assert.equal(nba.searchParams.get("aspect_filter"), "categoryId:261328,Sport:{Basketball}");
  assert.equal(nba.searchParams.get("filter"), "price:[..250],priceCurrency:USD,buyingOptions:{FIXED_PRICE|AUCTION}");
  const poke = new URL("https://x" + buildSearchPath(hunterSearchInput("Pokemon", { ...cfg, market: "EBAY_AU" })));
  assert.equal(poke.searchParams.get("q"), "pokemon (PSA, BGS, SGC, CGC)");
  assert.equal(poke.searchParams.get("category_ids"), "183454");
  assert.equal(poke.searchParams.get("aspect_filter"), null);
  assert.match(poke.searchParams.get("filter")!, /priceCurrency:AUD/);
  assert.deepEqual(hunterSearchInput("MLB", cfg).exclude, ["lot", "reprint", "custom", "digital", "proxy", "break"]);
  assert.equal(parseHunterSport("NBA"), "NBA");
  assert.equal(parseHunterSport("ohtani"), null);
});

test("liquidity: guide values need enough sales; your own values always pass", () => {
  assert.equal(liquidEnough({ source: "sportscardspro", salesVolume: 40 }, 12), true);
  assert.equal(liquidEnough({ source: "sportscardspro", salesVolume: 5 }, 12), false);
  assert.equal(liquidEnough({ source: "sportscardspro", salesVolume: null }, 12), false);
  assert.equal(liquidEnough({ source: "sportscardspro", salesVolume: null }, 0), true);
  assert.equal(liquidEnough({ source: "you" }, 12), true);
  assert.equal(liquidEnough(null, 0), false);
});

test("hunter form", () => {
  const ok = parseHunterForm(fd({ enabled: "on", budget: "$300", minPrice: "20", minSales: "12", s_MLB: "on", s_Pokemon: "on", x: "Lot, reprint", market: "EBAY_US" }));
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.value.sports, ["MLB", "Pokemon"]);
    assert.equal(ok.value.budget, 300); assert.equal(ok.value.excludeWords, "lot, reprint"); assert.equal(ok.value.includeAuctions, false);
  }
  const bad = (o: Record<string, string>, re: RegExp) => { const r = parseHunterForm(fd(o)); assert.equal(r.ok, false); if (!r.ok) assert.match(r.error, re); };
  bad({ budget: "abc" }, /Budget must be a number/);
  bad({ budget: "100", minPrice: "150" }, /lower than your budget/);
  bad({ budget: "100", minSales: "2.5" }, /whole number/);
  bad({ enabled: "on", budget: "100" }, /Tick at least one/);
  const off = parseHunterForm(fd({ budget: "100" })); assert.ok(off.ok); if (off.ok) assert.equal(off.value.enabled, false);
});

test("hunter's own ROI / profit minimums (blank = Settings)", async () => {
  const { hunterRules } = await import("../src/lib/hunter.js");
  const s = { minRoiPercent: 20, minProfitUsd: 25 };
  assert.deepEqual(hunterRules(s, { minRoi: null, minProfit: null }), s);
  assert.deepEqual(hunterRules(s, { minRoi: 40, minProfit: null }), { minRoiPercent: 40, minProfitUsd: 25 });
  assert.deepEqual(hunterRules(s, { minRoi: 0, minProfit: 50 }), { minRoiPercent: 0, minProfitUsd: 50 });
  const r = parseHunterForm(fd({ budget: "300", minRoi: "35", minProfit: "$40" }));
  assert.ok(r.ok); if (r.ok) { assert.equal(r.value.minRoi, 35); assert.equal(r.value.minProfit, 40); }
  const blank = parseHunterForm(fd({ budget: "300", minRoi: "", minProfit: "" }));
  assert.ok(blank.ok); if (blank.ok) { assert.equal(blank.value.minRoi, null); assert.equal(blank.value.minProfit, null); }
  const bad = parseHunterForm(fd({ budget: "300", minRoi: "-5" })); assert.equal(bad.ok, false);
});

test("title reading: any player, codes without #, Pokémon sets, sport from the Hunter search", async () => {
  const { cardFromListing, guessPlayer } = await import("../src/lib/ebay/parse.js");
  const { cardKey } = await import("../src/lib/cardKey.js");
  const read = (t: string, sport?: "MLB" | "NBA" | "Pokemon") => cardFromListing(t, [], { sport }).card;
  let c = read("2023 Topps Chrome Jackson Holliday #BCP-1 Orioles PSA 10 GEM MINT", "MLB");
  assert.equal(c.player, "Jackson Holliday"); assert.equal(c.cardNumber, "BCP-1"); assert.equal(c.sport, "MLB"); assert.ok(cardKey(c));
  c = read("Elly De La Cruz 2023 Topps Update #US1 Rookie RC Reds PSA 10", "MLB"); assert.equal(c.player, "Elly De La Cruz");
  c = read("2019 Bowman Chrome Wander Franco BCP-50 PSA 10 GEM MINT Rays", "MLB"); assert.equal(c.player, "Wander Franco"); assert.equal(c.cardNumber, "BCP-50");
  c = read("Bobby Witt Jr. 2022 Topps Series 1 No. 215 RC PSA 10 Royals", "MLB"); assert.equal(c.player, "Bobby Witt Jr."); assert.equal(c.cardNumber, "215");
  c = read("LOS ANGELES ANGELS 2018 TOPPS UPDATE SHOHEI OHTANI US1 PSA 10", "MLB"); assert.equal(c.player, "Shohei Ohtani"); assert.equal(c.cardNumber, "US1");
  c = read("2020-21 Panini Prizm LaMelo Ball #278 Rookie RC PSA10 Hornets", "NBA"); assert.equal(c.player, "Lamelo Ball"); assert.equal(c.cardNumber, "278");
  assert.notEqual(read("2023 Topps PSA10 Mike Trout #27", "MLB").cardNumber, "PSA10", "grades are never card numbers");
  c = read("Gardevoir ex 245/198 Scarlet & Violet Special Illustration Rare PSA 10", "Pokemon");
  assert.equal(c.player, "Gardevoir ex"); assert.equal(c.set, "Scarlet & Violet"); assert.equal(c.cardNumber, "245/198"); assert.ok(cardKey(c), "Pokémon needs no year");
  assert.equal(read("2023 Pokemon Scarlet & Violet 151 Charizard ex 199/165 PSA 10", "Pokemon").set, "151", "specific set beats series name");
  assert.equal(read("2018 Topps Update Shohei Ohtani #US1 PSA 10").sport, "MLB", "known player still sets sport without a hint");
  assert.equal(guessPlayer("PSA 10 GEM MINT 2023 Topps Chrome Refractor", "MLB"), null, "no name → no guess");
  assert.equal(cardKey({ sport: "MLB", player: "X Y", set: "Topps", cardNumber: "1", grader: "PSA", grade: 10 }), null, "sports cards still need a year");
});
