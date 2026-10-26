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
