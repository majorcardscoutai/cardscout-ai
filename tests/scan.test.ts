import { test } from "node:test";
import assert from "node:assert/strict";
import { cardKey } from "../src/lib/cardKey";
import { evaluateListing, shouldAlert, type CardValue } from "../src/lib/scan";
import { DEFAULT_SETTINGS } from "../src/lib/config";
import type { EbayListing } from "../src/lib/ebay/client";
import type { CardIdentity } from "../src/lib/types";

const ohtani: CardIdentity = {
  sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update", cardNumber: "US1",
  parallel: null, serialNumbered: null, variation: null, isRookie: true, grader: "PSA", grade: 10,
};

test("cardKey ignores harmless differences", () => {
  const k = cardKey(ohtani);
  assert.ok(k);
  assert.equal(cardKey({ ...ohtani, set: "2018 Topps Update", cardNumber: "#us1", player: "shohei  ohtani" }), k);
  assert.equal(cardKey({ ...ohtani, parallel: "Base" }), k);
  assert.equal(cardKey({ ...ohtani, isRookie: false }), k, "rookie flag is not part of identity");
  assert.equal(cardKey({ ...ohtani, player: "Luka Dončić" }), cardKey({ ...ohtani, player: "Luka Doncic" }));
});

test("cardKey separates anything that changes value", () => {
  const k = cardKey(ohtani);
  assert.notEqual(cardKey({ ...ohtani, grade: 9 }), k);
  assert.notEqual(cardKey({ ...ohtani, grader: "BGS" }), k);
  assert.notEqual(cardKey({ ...ohtani, parallel: "Gold" }), k);
  assert.notEqual(cardKey({ ...ohtani, serialNumbered: 99 }), k);
  assert.notEqual(cardKey({ ...ohtani, cardNumber: "US2" }), k);
  assert.notEqual(cardKey({ ...ohtani, year: 2019 }), k);
});

test("cardKey refuses to match incomplete cards", () => {
  assert.equal(cardKey({ ...ohtani, cardNumber: undefined as unknown as string }), null);
  assert.equal(cardKey({ ...ohtani, grade: null }), null);
  assert.ok(cardKey({ ...ohtani, grader: "RAW", grade: null }));
});

function listing(over: Partial<EbayListing> = {}): EbayListing {
  return {
    itemId: "111111111111", title: "2018 Topps Update Shohei Ohtani RC #US1 PSA 10",
    price: { value: 250, currency: "USD" }, isAuction: false, bidCount: null, acceptsOffers: false,
    shipping: { value: 20, currency: "USD" }, imageUrl: null, url: "https://www.ebay.com/itm/111111111111",
    sellerFeedbackScore: 500, sellerFeedbackPercent: 100, returnsAccepted: true, country: "US",
    listedAt: null, endsAt: null, condition: null,
    aspects: [
      { name: "Sport", value: "Baseball" }, { name: "Player/Athlete", value: "Shohei Ohtani" },
      { name: "Season", value: "2018" }, { name: "Set", value: "Topps Update" }, { name: "Card Number", value: "US1" },
      { name: "Professional Grader", value: "PSA" }, { name: "Grade", value: "10" },
    ],
    ...over,
  };
}

const values = new Map<string, CardValue>([
  [cardKey(ohtani)!, { id: "v1", key: cardKey(ohtani)!, title: "Ohtani US1 PSA 10", valueUsd: 400, updatedAt: "2026-10-13" }],
]);

test("evaluateListing uses your value and the profit engine", () => {
  const h = evaluateListing(listing(), DEFAULT_SETTINGS, values);
  assert.equal(h.valueUsd, 400);
  assert.equal(h.shippingUsd, 20);
  assert.ok(h.netProfitUsd !== null && h.roiPercent !== null);
  // 250 + 25 GST + 20 + 2 = 297 cost; 400 - 53.40 fees - 5 = 341.60 → +44.60, 15.0%
  assert.equal(h.netProfitUsd, 44.6);
  assert.equal(h.meetsCriteria, false, "15% ROI is under the 20% minimum");
});

test("parcel-locker setting replaces eBay shipping", () => {
  const s = { ...DEFAULT_SETTINGS, inboundShippingMode: "fixed" as const, inboundShippingFixedUsd: 0 };
  const h = evaluateListing(listing(), s, values);
  assert.equal(h.shippingUsd, 0);
  assert.equal(h.netProfitUsd, 64.6);
  assert.equal(h.meetsCriteria, true);
});

test("no value → no profit and never meets criteria", () => {
  const h = evaluateListing(listing({ aspects: [{ name: "Grade", value: "9" }, { name: "Professional Grader", value: "PSA" }] }), DEFAULT_SETTINGS, values);
  assert.equal(h.valueUsd, null);
  assert.equal(h.netProfitUsd, null);
  assert.equal(h.meetsCriteria, false);
});

test("a different grade does not borrow the PSA 10 value", () => {
  const h = evaluateListing(listing({ title: "2018 Topps Update Shohei Ohtani #US1 PSA 9", aspects: listing().aspects.map((a) => (a.name === "Grade" ? { name: "Grade", value: "9" } : a)) }), DEFAULT_SETTINGS, values);
  assert.equal(h.valueUsd, null);
});

test("alerts: fixed price when it meets criteria; auctions only in their last 24h", () => {
  const s = { ...DEFAULT_SETTINGS, inboundShippingMode: "fixed" as const, inboundShippingFixedUsd: 0 };
  const now = new Date("2026-10-13T00:00:00Z");
  assert.equal(shouldAlert(evaluateListing(listing(), s, values), now), true);
  const early = evaluateListing(listing({ isAuction: true, endsAt: "2026-10-18T00:00:00Z" }), s, values);
  assert.equal(shouldAlert(early, now), false);
  const ending = evaluateListing(listing({ isAuction: true, endsAt: "2026-10-13T10:00:00Z" }), s, values);
  assert.equal(shouldAlert(ending, now), true);
  const noValue = evaluateListing(listing({ aspects: [] , title: "random card lot"}), s, values);
  assert.equal(shouldAlert(noValue, now), false);
});
