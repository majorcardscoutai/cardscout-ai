import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateProfit,
  marketplaceFees,
  maxPurchasePrice,
  recommendedOpeningOffer,
} from "../src/lib/profit";
import { formatMoney, roundMoney, usdToAud } from "../src/lib/currency";

const settings = {
  marketplaceFeeRate: 0.1325,
  marketplaceFixedFeeUsd: 0.4,
  outboundShippingUsd: 5,
  importTaxRate: 0.1,
  otherCostsUsd: 2,
  minRoiPercent: 20,
  minProfitUsd: 25,
};

test("marketplace fees = rate × resale + fixed fee", () => {
  assert.equal(marketplaceFees(400, 0.1325, 0.4), 53.4);
  assert.equal(marketplaceFees(0, 0.1325, 0.4), 0);
});

test("net profit and ROI follow the documented formula (hand-checked example)", () => {
  // Buy at 265 + 18 shipping, resell at 380.
  // Import tax = 26.50 → acquisition = 265 + 26.5 + 18 + 2 = 311.50
  // Fees = 380 × 0.1325 + 0.40 = 50.75 → proceeds = 380 − 50.75 − 5 = 324.25
  // Net = 324.25 − 311.50 = 12.75 → ROI = 12.75 / 311.50 = 4.09 %
  const r = calculateProfit({
    purchasePriceUsd: 265,
    buyerShippingUsd: 18,
    expectedResaleUsd: 380,
    settings,
  });
  assert.equal(r.importTaxUsd, 26.5);
  assert.equal(r.totalAcquisitionCostUsd, 311.5);
  assert.equal(r.marketplaceFeesUsd, 50.75);
  assert.equal(r.netProceedsUsd, 324.25);
  assert.equal(r.netProfitUsd, 12.75);
  assert.equal(r.roiPercent, 4.09);
});

test("loss-making deals return negative profit and ROI", () => {
  const r = calculateProfit({ purchasePriceUsd: 500, buyerShippingUsd: 20, expectedResaleUsd: 400, settings });
  assert.ok(r.netProfitUsd < 0);
  assert.ok(r.roiPercent < 0);
});

test("rejects negative or invalid inputs", () => {
  assert.throws(() => calculateProfit({ purchasePriceUsd: -1, buyerShippingUsd: 0, expectedResaleUsd: 100, settings }));
  assert.throws(() => calculateProfit({ purchasePriceUsd: NaN, buyerShippingUsd: 0, expectedResaleUsd: 100, settings }));
});

test("buying at the max purchase price meets both min ROI and min profit", () => {
  for (const resale of [150, 380, 820, 2700, 10000]) {
    const max = maxPurchasePrice(resale, 18, settings);
    assert.ok(max !== null, `expected a max price for resale ${resale}`);
    const r = calculateProfit({ purchasePriceUsd: max!, buyerShippingUsd: 18, expectedResaleUsd: resale, settings });
    // Allow 1 cent of rounding tolerance on the ROI and profit floors.
    assert.ok(r.roiPercent >= settings.minRoiPercent - 0.01, `ROI ${r.roiPercent} at resale ${resale}`);
    assert.ok(r.netProfitUsd >= settings.minProfitUsd - 0.01, `profit ${r.netProfitUsd} at resale ${resale}`);
    // And paying $5 more must break at least one rule.
    const over = calculateProfit({ purchasePriceUsd: max! + 5, buyerShippingUsd: 18, expectedResaleUsd: resale, settings });
    assert.ok(over.roiPercent < settings.minRoiPercent || over.netProfitUsd < settings.minProfitUsd);
  }
});

test("max purchase price is null when the card can't meet your rules at any price", () => {
  assert.equal(maxPurchasePrice(30, 18, settings), null);
});

test("opening offer is below asking and below max price", () => {
  assert.equal(recommendedOpeningOffer(300, 400), 255); // 85 % of asking
  assert.equal(recommendedOpeningOffer(300, 200), 180); // 90 % of max
  assert.equal(recommendedOpeningOffer(300, null), null);
});

test("currency conversion and formatting", () => {
  assert.equal(roundMoney(usdToAud(100, 1.5)), 150);
  assert.throws(() => usdToAud(100, 0));
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(formatMoney(1234.5, "USD"), "US$1,235");
  assert.equal(formatMoney(12.5, "AUD"), "A$12.50");
  assert.equal(formatMoney(-40, "USD"), "-US$40.00");
});
