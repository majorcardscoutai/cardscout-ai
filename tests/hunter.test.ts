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
