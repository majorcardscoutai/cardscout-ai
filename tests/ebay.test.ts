import { test } from "node:test";
import assert from "node:assert/strict";
import { cardFromListing, itemIdFromUrl } from "../src/lib/ebay/parse";
import { buildSearchPath, getListing, mapItem, resetTokenCache, searchListings, toUsd } from "../src/lib/ebay/client";

// ---------- URL parsing ----------

test("itemIdFromUrl handles common eBay link formats", () => {
  assert.equal(itemIdFromUrl("https://www.ebay.com/itm/123456789012"), "123456789012");
  assert.equal(itemIdFromUrl("https://www.ebay.com.au/itm/2018-Topps-Ohtani-PSA-10/123456789012?hash=abc"), "123456789012");
  assert.equal(itemIdFromUrl("https://ebay.com/itm/123456789012/"), "123456789012");
  assert.equal(itemIdFromUrl("https://www.ebay.co.uk/itm/123456789012"), "123456789012");
  assert.equal(itemIdFromUrl("https://www.ebay.com/sch/i.html?item=123456789012"), "123456789012");
  assert.equal(itemIdFromUrl("  123456789012  "), "123456789012");
});

test("itemIdFromUrl rejects non-eBay and malformed links", () => {
  assert.equal(itemIdFromUrl("https://evil.com/itm/123456789012"), null);
  assert.equal(itemIdFromUrl("https://ebay.com.evil.net/itm/123456789012"), null);
  assert.equal(itemIdFromUrl("https://www.ebay.com/sch/i.html?_nkw=ohtani"), null);
  assert.equal(itemIdFromUrl("not a link"), null);
  assert.equal(itemIdFromUrl("12345"), null);
});

// ---------- Card suggestion ----------

test("item specifics take priority and are labelled", () => {
  const s = cardFromListing("2018 Topps Update Shohei Ohtani RC #US1 PSA 10 GEM MINT", [
    { name: "Sport", value: "Baseball" },
    { name: "Player/Athlete", value: "Shohei Ohtani" },
    { name: "Season", value: "2018" },
    { name: "Set", value: "2018 Topps Update" },
    { name: "Card Number", value: "US1" },
    { name: "Professional Grader", value: "Professional Sports Authenticator (PSA)" },
    { name: "Grade", value: "10" },
    { name: "Features", value: "Rookie" },
  ]);
  assert.deepEqual(s.missing, []);
  assert.equal(s.card.sport, "MLB");
  assert.equal(s.card.player, "Shohei Ohtani");
  assert.equal(s.card.year, 2018);
  assert.equal(s.card.cardNumber, "US1");
  assert.equal(s.card.grader, "PSA");
  assert.equal(s.card.grade, 10);
  assert.equal(s.card.isRookie, true);
  assert.equal(s.sources.player, "item specifics");
});

test("falls back to the title when item specifics are missing", () => {
  const s = cardFromListing("2018-19 Panini Prizm Luka Doncic Silver Prizm #280 RC BGS 9.5 Basketball");
  assert.equal(s.card.sport, "NBA");
  assert.equal(s.card.player, "Luka Doncic");
  assert.equal(s.card.year, 2018);
  assert.equal(s.card.set, "Panini Prizm");
  assert.equal(s.card.parallel, "Silver Prizm");
  assert.equal(s.card.cardNumber, "280");
  assert.equal(s.card.grader, "BGS");
  assert.equal(s.card.grade, 9.5);
  assert.equal(s.sources.set, "title");
});

test("Pokémon X/Y is a card number, not a print run", () => {
  const s = cardFromListing("1999 Pokemon Base Set Charizard 4/102 Holo PSA 8");
  assert.equal(s.card.sport, "Pokemon");
  assert.equal(s.card.cardNumber, "4/102");
  assert.equal(s.card.serialNumbered, undefined);
  assert.equal(s.card.parallel, "Holo");
});

test("serial-numbered sports cards are detected", () => {
  const s = cardFromListing("2023 Topps Chrome Ohtani Gold Refractor 12/50 #1 baseball");
  assert.equal(s.card.serialNumbered, 50);
  assert.equal(s.card.parallel, "Gold Refractor");
});

test("unknown fields are reported as missing, never invented", () => {
  const s = cardFromListing("Vintage basketball card lot nice");
  assert.ok(s.missing.includes("player"));
  assert.ok(s.missing.includes("year"));
  assert.ok(s.missing.includes("card number"));
  assert.equal(s.card.player, undefined);
});

test("raw cards are recognised", () => {
  const s = cardFromListing("2009 Bowman Chrome Draft Mike Trout #BDPP89 raw ungraded");
  assert.equal(s.card.grader, "RAW");
  assert.equal(s.card.cardNumber, "BDPP89");
  assert.ok(!s.missing.includes("grade"));
});

// ---------- Mapping and currency ----------

test("mapItem reads eBay's fields and prefers the current bid for auctions", () => {
  const m = mapItem({
    itemId: "v1|123456789012|0",
    title: "Test",
    price: { value: "100.00", currency: "USD" },
    currentBidPrice: { value: "42.50", currency: "USD" },
    bidCount: 3,
    buyingOptions: ["AUCTION"],
    shippingOptions: [{ shippingCost: { value: "18.00", currency: "USD" } }],
    seller: { feedbackScore: 900, feedbackPercentage: "99.6" },
    returnTerms: { returnsAccepted: false },
    localizedAspects: [{ name: "Grade", value: "10" }],
  });
  assert.equal(m.itemId, "123456789012");
  assert.equal(m.isAuction, true);
  assert.deepEqual(m.price, { value: 42.5, currency: "USD" });
  assert.equal(m.shipping?.value, 18);
  assert.equal(m.sellerFeedbackPercent, 99.6);
  assert.equal(m.returnsAccepted, false);
  assert.equal(m.aspects.length, 1);
});

test("toUsd converts AUD and refuses other currencies", () => {
  assert.equal(toUsd({ value: 150, currency: "AUD" }, 1.5), 100);
  assert.equal(toUsd({ value: 99.99, currency: "USD" }, 1.5), 99.99);
  assert.equal(toUsd({ value: 10, currency: "GBP" }, 1.5), null);
  assert.equal(toUsd(null, 1.5), null);
});

test("Best Offer filter asks eBay for listings that accept offers", () => {
  const p = buildSearchPath({ q: "jordan fleer", market: "EBAY_US", category: "sportsCards", maxPrice: null, format: "BEST_OFFER" });
  assert.equal(new URL("https://x" + p).searchParams.get("filter"), "buyingOptions:{BEST_OFFER}");
});

test("search path encodes filters correctly", () => {
  const p = buildSearchPath({ q: "ohtani psa 10", market: "EBAY_AU", category: "sportsCards", maxPrice: 500, format: "FIXED_PRICE" });
  const u = new URL("https://x" + p);
  assert.equal(u.searchParams.get("q"), "ohtani psa 10");
  assert.equal(u.searchParams.get("category_ids"), "261328");
  assert.equal(u.searchParams.get("filter"), "price:[..500],priceCurrency:AUD,buyingOptions:{FIXED_PRICE}");
  assert.equal(u.searchParams.get("sort"), "newlyListed");
});

// ---------- Client behaviour with a fake eBay ----------

type Handler = (url: string, init: RequestInit) => { status: number; body: unknown };
function fakeEbay(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

function withKeys() {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  resetTokenCache();
}

test("not configured → clear message, no network call", async () => {
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
  resetTokenCache();
  const calls = fakeEbay(() => ({ status: 200, body: {} }));
  const r = await getListing("123456789012");
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /isn't connected/);
  assert.equal(calls.length, 0);
});

test("gets a token once, caches it, and sends the right headers", async () => {
  withKeys();
  const calls = fakeEbay((url) =>
    url.includes("oauth2/token")
      ? { status: 200, body: { access_token: "T1", expires_in: 7200 } }
      : { status: 200, body: { legacyItemId: "123456789012", title: "Card", price: { value: "10", currency: "USD" }, buyingOptions: ["FIXED_PRICE"] } },
  );
  const a = await getListing("123456789012", "EBAY_AU");
  const b = await getListing("123456789012", "EBAY_AU");
  assert.ok(a.ok && b.ok);
  assert.equal(calls.filter((c) => c.url.includes("oauth2/token")).length, 1);
  const itemCall = calls.find((c) => c.url.includes("get_item_by_legacy_id"))!;
  const h = itemCall.init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer T1");
  assert.equal(h["X-EBAY-C-MARKETPLACE-ID"], "EBAY_AU");
  const tokenCall = calls.find((c) => c.url.includes("oauth2/token"))!;
  assert.match(String(tokenCall.init.body), /grant_type=client_credentials/);
});

test("refreshes the token once on 401, then succeeds", async () => {
  withKeys();
  let tokens = 0;
  let items = 0;
  fakeEbay((url) => {
    if (url.includes("oauth2/token")) return { status: 200, body: { access_token: `T${++tokens}`, expires_in: 7200 } };
    items++;
    return items === 1 ? { status: 401, body: {} } : { status: 200, body: { legacyItemId: "123456789012", title: "ok" } };
  });
  const r = await getListing("123456789012");
  assert.ok(r.ok);
  assert.equal(tokens, 2);
});

test("rate limit, not found, bad keys and network failures give friendly errors", async () => {
  withKeys();
  fakeEbay((url) => (url.includes("token") ? { status: 200, body: { access_token: "T" } } : { status: 429, body: {} }));
  assert.match((await getListing("123456789012") as { error: string }).error, /limit/);

  withKeys();
  fakeEbay((url) => (url.includes("token") ? { status: 200, body: { access_token: "T" } } : { status: 404, body: {} }));
  assert.match((await getListing("123456789012") as { error: string }).error, /ended or been removed/);

  withKeys();
  fakeEbay(() => ({ status: 401, body: { error: "invalid_client" } }));
  assert.match((await getListing("123456789012") as { error: string }).error, /rejected the keys/);

  withKeys();
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.match((await getListing("123456789012") as { error: string }).error, /Couldn't reach eBay/);
});

test("search returns de-duplicated listings", async () => {
  withKeys();
  fakeEbay((url) =>
    url.includes("token")
      ? { status: 200, body: { access_token: "T" } }
      : {
          status: 200,
          body: {
            total: 3,
            itemSummaries: [
              { itemId: "v1|111111111111|0", title: "A", price: { value: "5", currency: "USD" } },
              { itemId: "v1|111111111111|0", title: "A again", price: { value: "5", currency: "USD" } },
              { itemId: "v1|222222222222|0", title: "B", price: { value: "7", currency: "USD" } },
            ],
          },
        },
  );
  const r = await searchListings({ q: "ohtani", market: "EBAY_US", category: "sportsCards", maxPrice: null, format: "ALL" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data.items.map((i) => i.itemId), ["111111111111", "222222222222"]);
  assert.equal((await searchListings({ q: "a", market: "EBAY_US", category: "sportsCards", maxPrice: null, format: "ALL" })).ok, false);
});
