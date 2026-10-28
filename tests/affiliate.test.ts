import { test } from "node:test";
import assert from "node:assert/strict";
import { affiliateCampaignId, endUserContext, mapItem } from "../src/lib/ebay/client";

test("no campaign ID: header only carries the buyer's location", () => {
  delete process.env.EBAY_CAMPAIGN_ID;
  assert.equal(affiliateCampaignId(), null);
  assert.equal(endUserContext({ country: "AU" }), "contextualLocation=country%3DAU");
});

test("campaign ID is added to the header; bad values are ignored", () => {
  process.env.EBAY_CAMPAIGN_ID = " 5339123456 ";
  assert.equal(endUserContext({ country: "AU", postcode: "2127" }), "affiliateCampaignId=5339123456,contextualLocation=country%3DAU%2Czip%3D2127");
  process.env.EBAY_CAMPAIGN_ID = "abc";
  assert.equal(affiliateCampaignId(), null);
  delete process.env.EBAY_CAMPAIGN_ID;
});

test("tracked link is preferred, plain link is the fallback", () => {
  const base = { itemId: "v1|123|0", title: "Card", itemWebUrl: "https://www.ebay.com/itm/123" };
  assert.equal(mapItem(base).url, "https://www.ebay.com/itm/123");
  assert.equal(mapItem({ ...base, itemAffiliateWebUrl: "https://www.ebay.com/itm/123?mkcid=1&campid=5339123456" }).url, "https://www.ebay.com/itm/123?mkcid=1&campid=5339123456");
});

import { cardFromListing } from "../src/lib/ebay/parse";
import { normNumber } from "../src/lib/provider";

test("Pokémon gallery numbers and leading zeros", () => {
  const z = cardFromListing("Pokemon Zamazenta v Full Art GG54/GG70 Crown Zenith Galarian Gallery PSA 10", [], { sport: "Pokemon" });
  assert.equal(z.card.cardNumber, "GG54/GG70");
  assert.equal(normNumber(z.card.cardNumber), normNumber("#GG54"));
  assert.equal(cardFromListing("Pikachu VMAX TG17/TG30 Lost Origin PSA 9", [], { sport: "Pokemon" }).card.cardNumber, "TG17/TG30");
  assert.equal(normNumber("015/172"), normNumber("#15"));
  assert.equal(normNumber("GG05"), "gg5");
  assert.notEqual(normNumber("150"), normNumber("15"));
  assert.notEqual(normNumber("105"), normNumber("15"));
});

import { offCentreInTitle } from "../src/lib/ebay/parse";

test("off-centre (OC) listings are spotted", () => {
  for (const t of ["1952 Topps Mickey Mantle PSA 8 (OC)", "Mantle PSA 8 OC", "Jordan Fleer RC off center PSA 7", "Charizard off-centre raw", "PSA 9 OC Kobe", "1955 Topps Roberto Clemente #164 PSA 6 Oc", "Mantle psa 7 oc"])
    assert.equal(offCentreInTitle(t), true, t);
  for (const t of ["Kobe Bryant Topps Chrome PSA 10", "OCTAGON Charizard", "Rocket Mosaic PSA 10", "Doc Rivers auto", "2023 Panini PSA 10 #OC1x"])
    assert.equal(offCentreInTitle(t), false, t);
});

import { mixedGradeLabel } from "../src/lib/scan";

test("BGS/CGC 9 on the any-company grade price is flagged; PSA, 10s and own values aren't", () => {
  const auto = { source: "pricecharting" as const, graderSpecific: false };
  assert.equal(mixedGradeLabel(auto, "pokemon|lugia||neo genesis|9|1st edition holo|||bgs|9"), "BGS 9");
  assert.equal(mixedGradeLabel(auto, "pokemon|lugia||neo genesis|9||||psa|9"), null);
  assert.equal(mixedGradeLabel({ source: "pricecharting" as const, graderSpecific: true }, "pokemon|x||s|1||||cgc|10"), null);
  assert.equal(mixedGradeLabel({ source: "you" as const, graderSpecific: false }, "pokemon|x||s|1||||bgs|9"), null);
  assert.equal(mixedGradeLabel(null, "pokemon|x||s|1||||bgs|9"), null);
});

import { qualifiedGradeInTitle } from "../src/lib/ebay/parse";
test("qualified grades in any case for OC, capitals only for the rest", () => {
  assert.equal(qualifiedGradeInTitle("1955 Topps Roberto Clemente #164 PSA 6 Oc"), true);
  assert.equal(qualifiedGradeInTitle("Mantle PSA 8 (oc)"), true);
  assert.equal(qualifiedGradeInTitle("Ozzie Smith PSA 9 St Louis Cardinals"), false);
  assert.equal(qualifiedGradeInTitle("Jordan PSA 9 MC"), true);
});

import { scoreProduct } from "../src/lib/provider";
test("Chrome parallels in non-Chrome sets (Topps Heritage)", () => {
  const c = cardFromListing("2026 TOPPS HERITAGE CHROME-PINK SPARKLE #290 SHOHEI OHTANI PSA 9").card;
  assert.equal(c.parallel, "Chrome Pink Sparkle");
  const p = { id: "1", productName: "Shohei Ohtani [Pink Sparkle Chrome] #290", consoleName: "Baseball Cards 2026 Topps Heritage", prices: { "graded-price": 15000 }, salesVolume: null };
  assert.equal(scoreProduct(c, p).ok, true);
  const base = { ...p, productName: "Shohei Ohtani #290" };
  assert.equal(scoreProduct(c, base).ok, false);
  assert.equal(cardFromListing("2023 Topps Heritage Chrome #100 Shohei Ohtani PSA 10").card.parallel, "Chrome");
  assert.equal(cardFromListing("2018 Topps Chrome Update #HMT1 Shohei Ohtani PSA 10").card.parallel, undefined);
  assert.equal(cardFromListing("2018 Topps Chrome #150 Shohei Ohtani Gold Refractor PSA 10").card.parallel, "Gold Refractor");
});

test("Base Set 2 spellings and Pokémon titles that don't say Pokémon", () => {
  const a = cardFromListing("2000 POKEMON GAME BASE II #4 CHARIZARD-HOLO PSA 8").card;
  assert.equal(a.set, "Base Set 2");
  assert.equal(a.cardNumber, "4");
  const b = cardFromListing("Base set 2 Charizard Holofoil 4/130 PSA 7 *MOUTH SWIRL*").card;
  assert.equal(b.sport, "Pokemon");
  assert.equal(b.cardNumber, "4/130");
  assert.equal(b.serialNumbered, undefined);
  assert.equal(cardFromListing("Pokemon Charizard 4/102 Base Set 1999 Holo PSA 5").card.set, "Base Set");
});

import { buildSearchPath, fitsGrading, searchWords } from "../src/lib/ebay/client";
test("Graded or raw: PSA only, BGS only, all graded, ungraded", () => {
  const psa = { title: "2018 Topps Update Ohtani #US1 PSA 10", condition: "Graded", aspects: [] };
  const bgs = { title: "2018 Topps Update Ohtani #US1 Beckett 9.5", condition: "Graded", aspects: [] };
  const sgc = { title: "Ohtani #US1 SGC 10", condition: "Graded", aspects: [] };
  const raw = { title: "Ohtani #US1 raw NM", condition: "Ungraded", aspects: [] };
  const byAspect = { title: "Ohtani US1 slab", condition: "Graded", aspects: [{ name: "Professional Grader", value: "Professional Sports Authenticator (PSA)" }] };
  assert.deepEqual([psa, bgs, sgc, raw, byAspect].map((l) => fitsGrading(l, "psa")), [true, false, false, false, true]);
  assert.deepEqual([psa, bgs, sgc, raw].map((l) => fitsGrading(l, "bgs")), [false, true, false, false]);
  assert.deepEqual([psa, bgs, sgc, raw].map((l) => fitsGrading(l, "graded")), [true, true, true, false]);
  assert.deepEqual([psa, bgs, sgc, raw].map((l) => fitsGrading(l, "raw")), [false, false, false, true]);
  assert.deepEqual([psa, raw].map((l) => fitsGrading(l, "any")), [true, true]);
  assert.equal(searchWords("ohtani us1", "psa"), "ohtani us1 PSA");
  assert.equal(searchWords("ohtani psa 10", "psa"), "ohtani psa 10");
  assert.equal(searchWords("ohtani us1", "bgs"), "ohtani us1 (BGS, Beckett)");
  const path = decodeURIComponent(buildSearchPath({ q: "ohtani", market: "EBAY_US", category: "sportsCards", maxPrice: null, format: "FIXED_PRICE", grading: "bgs" }).replace(/\+/g, " "));
  assert.match(path, /conditionIds:\{2750\}/);
  assert.match(path, /q=ohtani \(BGS, Beckett\)/);
});

import { inconsistentGradePrice, priceFor } from "../src/lib/provider";
test("guide prices that don't make sense are never used (Legendary Collection Gengar)", () => {
  const prices = { "condition-14-price": 300000, "condition-15-price": 366285, "condition-16-price": 575839, "cib-price": 727414, "new-price": 1088064, "graded-price": 167473, "manual-only-price": 735700 };
  assert.equal(inconsistentGradePrice(prices, "condition-16-price"), "graded-price");
  assert.equal(inconsistentGradePrice(prices, "new-price"), "graded-price");
  const p = { id: "1", productName: "Gengar [Reverse Holo] #11", consoleName: "Pokemon Legendary Collection", prices, salesVolume: 10 };
  assert.equal(priceFor({ sport: "Pokemon", grader: "PSA", grade: 6 }, p), null);
  assert.equal(priceFor({ sport: "Pokemon", grader: "PSA", grade: 10 }, p)?.usd, 7357);
  // Normal ladders are fine, and a small dip (under 1.5×) is allowed
  const ok = { "condition-16-price": 18520, "cib-price": 23331, "new-price": 37125, "graded-price": 134676, "manual-only-price": 735700 };
  assert.equal(inconsistentGradePrice(ok, "condition-16-price"), null);
  assert.equal(inconsistentGradePrice({ "cib-price": 12000, "new-price": 10000 }, "cib-price"), null);
});

test("title and eBay item specifics disagree on the grade → no grade", () => {
  const r = cardFromListing("2002 POKEMON LEGENDARY COLLECTION #11 GENGAR-REVERSE FOIL PSA 6", [{ name: "Professional Grader", value: "Professional Sports Authenticator (PSA)" }, { name: "Grade", value: "8" }]);
  assert.equal(r.card.grade, undefined);
  assert.ok(r.missing.some((m) => /PSA 6 in the title/.test(m)));
  const ok = cardFromListing("2002 POKEMON LEGENDARY COLLECTION #11 GENGAR-REVERSE FOIL PSA 6", [{ name: "Professional Grader", value: "PSA" }, { name: "Grade", value: "6" }]);
  assert.equal(ok.card.grade, 6);
});

import { cardLanguageInTitle } from "../src/lib/ebay/parse";
import { cardKey } from "../src/lib/cardKey";
import { usableValue } from "../src/lib/scan";
test("non-English Pokémon cards are never matched to English prices", () => {
  const g = cardFromListing("Pokemon Altaria Holo Deoxys 1/107 German PSA 10 Gem Mint");
  assert.equal(g.card.language, "German");
  assert.equal(cardKey(g.card), null);
  assert.ok(g.missing.some((m) => /German card/.test(m)));
  assert.equal(cardLanguageInTitle("Charizard ex 151 Japanese SAR PSA 10"), "Japanese");
  assert.equal(cardLanguageInTitle("Pikachu VMAX JP S8b PSA 10"), "Japanese");
  assert.equal(cardLanguageInTitle("Charizard Base Set English PSA 9"), null);
  assert.equal(cardLanguageInTitle("Charizard Base Set 4/102 PSA 9"), null);
  // English titles are unaffected
  assert.ok(cardKey(cardFromListing("Pokemon Card Charizard 4/102 Base Set 1999 Holo PSA 5").card));
  // a value saved earlier for the English card is dropped for a German listing
  assert.equal(usableValue({ source: "pricecharting" as const }, "Pokemon Altaria Holo Deoxys 1/107 German PSA 10", "k"), null);
  // sports titles with "JP" (e.g. a player's initials) aren't affected
  assert.equal(cardFromListing("2017 Topps Update JP Crawford #US1 PSA 10").card.language, undefined);
});

import { scoreLiveDeal } from "../src/lib/live-score";
test("deal score out of 100 with its breakdown, capped when evidence is thin", () => {
  const now = Date.parse("2026-10-28T05:00:00Z");
  const base = { title: "2018 Topps Update Shohei Ohtani #US1 PSA 10", priceUsd: 300, valueUsd: 500, roiPercent: 45, netProfitUsd: 120, isAuction: false, salesVolume: 1446, valueSource: "sportscardspro", checkedAt: "2026-10-28T04:30:00Z" };
  const s = scoreLiveDeal(base, now)!;
  assert.equal(s.factors.reduce((a, f) => a + f.max, 0), 100);
  assert.equal(s.factors.length, 6);
  assert.ok(s.total >= 80 && s.total <= 100, String(s.total));
  assert.deepEqual(s.caps, []);
  // thin evidence holds it down
  assert.ok(scoreLiveDeal({ ...base, salesVolume: 2 }, now)!.total <= 75);
  assert.ok(scoreLiveDeal({ ...base, salesVolume: null }, now)!.total <= 70);
  assert.ok(scoreLiveDeal({ ...base, mixedGrade: "BGS 9" }, now)!.total <= 60);
  assert.ok(scoreLiveDeal({ ...base, title: base.title + " OC" }, now)!.total <= 60);
  assert.match(scoreLiveDeal({ ...base, salesVolume: null }, now)!.caps[0], /capped at 70/);
  // auctions and stale details lose risk points
  const risky = scoreLiveDeal({ ...base, isAuction: true, checkedAt: "2026-10-27T20:00:00Z" }, now)!;
  assert.equal(risky.factors.find((f) => f.label === "Listing risk")!.points, 5);
  // no value → no score
  assert.equal(scoreLiveDeal({ ...base, valueUsd: null }, now), null);
});
