import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLiveDeal, tooGoodReason } from "../src/lib/live-score";
import { shouldAlert, type ScanHit } from "../src/lib/scan";

test("too good to be true: value 3×+ the price, or ROI over 150% (guide values only)", () => {
  // The Jeter case: US$286 price, US$1,441 guide value, 398% ROI.
  assert.match(tooGoodReason({ valueSource: "sportscardspro", valueUsd: 1441, priceUsd: 286, roiPercent: 398.3 }) ?? "", /5\.0× the price/);
  assert.match(tooGoodReason({ valueSource: "pricecharting", valueUsd: 500, priceUsd: 200, roiPercent: 160 }) ?? "", /160% ROI/);
  assert.equal(tooGoodReason({ valueSource: "sportscardspro", valueUsd: 1000, priceUsd: 800, roiPercent: 24 }), null);
  // Your own Card Value is trusted.
  assert.equal(tooGoodReason({ valueSource: "you", valueUsd: 1441, priceUsd: 286, roiPercent: 398 }), null);
});

test("score is capped at 50 and alerts don't fire", () => {
  const s = scoreLiveDeal({ title: "2002 Bowman Chrome Derek Jeter #2 PSA 10", priceUsd: 286, valueUsd: 1441, roiPercent: 398, netProfitUsd: 1148, isAuction: false, salesVolume: 30, valueSource: "sportscardspro" });
  assert.ok(s && s.total <= 50);
  assert.match(s!.caps.join(" "), /Too good to be true/);
  const hit = { meetsCriteria: true, isAuction: false, endsAt: null, valueSource: "sportscardspro", valueUsd: 1441, priceUsd: 286, roiPercent: 398 } as unknown as ScanHit;
  assert.equal(shouldAlert(hit), false);
  assert.equal(shouldAlert({ ...hit, valueUsd: 1000, priceUsd: 800, roiPercent: 24 } as ScanHit), true);
});
