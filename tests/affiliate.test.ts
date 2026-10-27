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
