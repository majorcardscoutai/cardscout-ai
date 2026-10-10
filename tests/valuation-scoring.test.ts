import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMarketValue, weightedMedian } from "../src/lib/valuation";
import { scoreDeal, SCORE_WEIGHTS, type ScoreInputs } from "../src/lib/scoring";
import { analyseListing } from "../src/lib/analysis";
import { DEFAULT_SETTINGS } from "../src/lib/config";
import type { SoldComp } from "../src/lib/types";
import { DEMO_AS_OF, DEMO_COMPS, DEMO_LISTINGS } from "../src/data/demo";

const asOf = new Date("2026-10-10T00:00:00Z");
const day = (n: number) => new Date(asOf.getTime() - n * 86_400_000).toISOString();

function comp(price: number, ago: number, match: "exact" | "close" = "exact", saleType: SoldComp["saleType"] = "AUCTION"): SoldComp {
  return { id: `${price}-${ago}`, isDemo: true, title: "t", soldPriceUsd: price, soldDate: day(ago), saleType, match, source: "test", sourceUrl: null };
}

test("weighted median", () => {
  assert.equal(weightedMedian([{ value: 1, weight: 1 }, { value: 2, weight: 1 }, { value: 3, weight: 1 }]), 2);
  assert.equal(weightedMedian([{ value: 1, weight: 1 }, { value: 100, weight: 10 }]), 100);
});

test("returns no value when there are too few sold comps — never guesses", () => {
  const r = estimateMarketValue([comp(100, 3), comp(110, 10)], asOf);
  assert.equal(r.estimatedValueUsd, null);
  assert.equal(r.confidence, "none");
  assert.equal(r.basis, "insufficient");
});

test("ignores sales older than the look-back window", () => {
  const r = estimateMarketValue([comp(100, 3), comp(100, 10), comp(100, 200), comp(100, 300)], asOf);
  assert.equal(r.estimatedValueUsd, null);
  assert.equal(r.compsExcluded.filter((e) => e.reason.startsWith("Older")).length, 2);
});

test("prefers exact comps and excludes close matches when enough exact exist", () => {
  const r = estimateMarketValue([comp(100, 1), comp(102, 5), comp(98, 9), comp(500, 2, "close")], asOf);
  assert.equal(r.basis, "exact");
  assert.equal(r.estimatedValueUsd, 100);
  assert.ok(r.compsUsed.every((c) => c.match === "exact"));
});

test("falls back to close comps with reduced confidence", () => {
  const r = estimateMarketValue([comp(100, 1), comp(120, 5, "close"), comp(90, 9, "close")], asOf);
  assert.equal(r.basis, "close");
  assert.equal(r.confidence, "low");
});

test("removes price outliers", () => {
  const r = estimateMarketValue([comp(100, 1), comp(101, 2), comp(99, 3), comp(100, 4), comp(102, 5), comp(400, 6)], asOf);
  assert.ok(r.compsExcluded.some((e) => e.comp.soldPriceUsd === 400 && e.reason.includes("outlier")));
  assert.ok(r.estimatedValueUsd! < 110);
});

test("many tight, recent exact comps give high confidence", () => {
  const r = estimateMarketValue([1, 4, 8, 12, 20, 25].map((d, i) => comp(100 + i, d)), asOf);
  assert.equal(r.confidence, "high");
});

const baseScore: ScoreInputs = {
  askingPriceUsd: 70,
  estimatedValueUsd: 100,
  roiPercent: 30,
  demandTier: "elite",
  valuationConfidence: "high",
  compsUsedCount: 8,
  compBasis: "exact",
  salesLast90Days: 8,
  population: null,
  listing: {
    seller: { feedbackScore: 1000, feedbackPercent: 99.9 },
    hasBackPhoto: true,
    returnsAccepted: true,
    format: "BUY_IT_NOW",
    card: { sport: "MLB", player: "x", year: 2018, set: "s", cardNumber: "1", parallel: null, serialNumbered: null, variation: null, isRookie: true, grader: "PSA", grade: 10 },
  },
};

test("score weights add up to 100", () => {
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((s, v) => s + v, 0), 100);
});

test("score is null without a verified market value", () => {
  const s = scoreDeal({ ...baseScore, estimatedValueUsd: null, valuationConfidence: "none" });
  assert.equal(s.total, null);
});

test("score stays within 0–100 and every factor within its max", () => {
  const s = scoreDeal(baseScore);
  assert.ok(s.total! >= 0 && s.total! <= 100);
  for (const f of s.factors) assert.ok(f.points >= 0 && f.points <= f.max, f.label);
});

test("low confidence caps the score at 60", () => {
  const great = { ...baseScore, askingPriceUsd: 40, roiPercent: 120 };
  assert.ok(scoreDeal(great).total! > 60);
  const capped = scoreDeal({ ...great, valuationConfidence: "low" });
  assert.ok(capped.total! <= 60);
  assert.equal(capped.cappedBy, "low");
});

test("missing population data is flagged, not invented", () => {
  const s = scoreDeal(baseScore);
  const scarcity = s.factors.find((f) => f.key === "scarcity")!;
  assert.equal(scarcity.missingData, true);
  assert.ok(scarcity.points < scarcity.max);
});

test("risk flags reduce the listing-risk points", () => {
  const risky = scoreDeal({
    ...baseScore,
    listing: { ...baseScore.listing, hasBackPhoto: false, returnsAccepted: false, seller: { feedbackScore: 10, feedbackPercent: 95 } },
  });
  const f = risky.factors.find((x) => x.key === "listingRisk")!;
  assert.ok(f.points <= 2);
});

test("bigger discount → higher score, all else equal", () => {
  const cheap = scoreDeal({ ...baseScore, askingPriceUsd: 60 });
  const pricey = scoreDeal({ ...baseScore, askingPriceUsd: 95 });
  assert.ok(cheap.total! > pricey.total!);
});

test("every demo listing analyses without errors and is labelled demo", () => {
  for (const l of DEMO_LISTINGS) {
    const a = analyseListing(l, DEMO_COMPS[l.id] ?? [], null, DEFAULT_SETTINGS, DEMO_AS_OF);
    assert.equal(a.listing.isDemo, true);
    assert.equal(a.listing.listingUrl, null, "demo listings must not link to real listings");
    if (a.valuation.estimatedValueUsd === null) assert.equal(a.score.total, null);
  }
});

test("demo Trout raw card is correctly marked as insufficient data", () => {
  const l = DEMO_LISTINGS.find((x) => x.id === "demo-trout-bdpp89-raw")!;
  const a = analyseListing(l, DEMO_COMPS[l.id], null, DEFAULT_SETTINGS, DEMO_AS_OF);
  assert.equal(a.valuation.estimatedValueUsd, null);
  assert.equal(a.meetsCriteria, false);
});
