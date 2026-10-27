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
  for (const t of ["1952 Topps Mickey Mantle PSA 8 (OC)", "Mantle PSA 8 OC", "Jordan Fleer RC off center PSA 7", "Charizard off-centre raw", "PSA 9 OC Kobe"])
    assert.equal(offCentreInTitle(t), true, t);
  for (const t of ["Kobe Bryant Topps Chrome PSA 10", "OCTAGON Charizard", "Rocket Mosaic PSA 10", "Doc Rivers auto", "2023 Panini PSA 10 #OC1x"])
    assert.equal(offCentreInTitle(t), false, t);
});
