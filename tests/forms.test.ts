import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCard,
  parseHoldingForm,
  parseNumber,
  parseSettingsForm,
  parseWatchlistForm,
  toUsd,
} from "../src/lib/forms";
import { sessionToken, safeNextPath } from "../src/lib/auth";

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const ohtani = {
  sport: "MLB",
  player: "Shohei Ohtani",
  year: "2018",
  set: "Topps Chrome",
  cardNumber: "#150",
  parallel: "Refractor",
  serialNumbered: "",
  variation: "",
  isRookie: "on",
  grader: "PSA",
  grade: "9",
};

test("parseNumber accepts friendly formats and rejects junk", () => {
  assert.deepEqual(parseNumber("1,250.50", "x"), { ok: true, value: 1250.5 });
  assert.deepEqual(parseNumber("$300", "x"), { ok: true, value: 300 });
  assert.deepEqual(parseNumber("A$300", "x"), { ok: true, value: 300 });
  assert.deepEqual(parseNumber("300 AUD", "x"), { ok: true, value: 300 });
  assert.match((parseNumber("abc", "Price") as { error: string }).error, /must be a number/);
  assert.equal(parseNumber("", "Price").ok, false);
  assert.deepEqual(parseNumber("", "x", { optional: true }), { ok: true, value: null });
  assert.equal(parseNumber("-5", "x", { min: 0 }).ok, false);
  assert.equal(parseNumber("1.5", "x", { integer: true }).ok, false);
});

test("AUD amounts are converted to USD for storage", () => {
  assert.equal(toUsd(150, "AUD", 1.5), 100);
  assert.equal(toUsd(100, "USD", 1.5), 100);
});

test("parseCard builds an exact card identity", () => {
  const r = parseCard(fd(ohtani));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.cardNumber, "150"); // leading # removed
  assert.equal(r.value.grade, 9);
  assert.equal(r.value.isRookie, true);
  assert.equal(r.value.parallel, "Refractor");
  assert.equal(r.value.variation, null);
});

test("raw cards have no grade; graded cards need a valid grade", () => {
  const raw = parseCard(fd({ ...ohtani, grader: "RAW", grade: "" }));
  assert.ok(raw.ok && raw.value.grade === null);
  assert.equal(parseCard(fd({ ...ohtani, grade: "" })).ok, false);
  assert.equal(parseCard(fd({ ...ohtani, grade: "11" })).ok, false);
  assert.equal(parseCard(fd({ ...ohtani, grade: "9.3" })).ok, false);
  assert.ok(parseCard(fd({ ...ohtani, grader: "BGS", grade: "9.5" })).ok);
});

test("parseCard rejects missing essentials and bad categories", () => {
  assert.equal(parseCard(fd({ ...ohtani, player: "" })).ok, false);
  assert.equal(parseCard(fd({ ...ohtani, sport: "Cricket" })).ok, false);
  assert.equal(parseCard(fd({ ...ohtani, year: "1700" })).ok, false);
  assert.equal(parseCard(fd({ ...ohtani, cardNumber: "" })).ok, false);
  const serial = parseCard(fd({ ...ohtani, serialNumbered: "/99" }));
  assert.ok(serial.ok && serial.value.serialNumbered === 99);
});

test("watchlist form converts AUD prices and builds a title", () => {
  const r = parseWatchlistForm(
    fd({ ...ohtani, currency: "AUD", asking: "450", shipping: "30", resale: "750", url: "https://www.ebay.com.au/itm/123", note: "nice" }),
    1.5,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.askingPriceUsd, 300);
  assert.equal(r.value.buyerShippingUsd, 20);
  assert.equal(r.value.expectedResaleUsd, 500);
  assert.equal(r.value.targetPriceUsd, null);
  assert.match(r.value.title, /2018 Topps Chrome Shohei Ohtani #150 Refractor RC PSA 9/);
});

test("watchlist form rejects a non-web link", () => {
  const r = parseWatchlistForm(fd({ ...ohtani, asking: "300", url: "javascript:alert(1)" }), 1.5);
  assert.equal(r.ok, false);
});

test("holding form validates dates", () => {
  const today = new Date("2026-10-10T00:00:00Z");
  const ok = parseHoldingForm(fd({ ...ohtani, purchasePrice: "200", purchasedAt: "2026-09-01" }), 1.5, today);
  assert.ok(ok.ok);
  const future = parseHoldingForm(fd({ ...ohtani, purchasePrice: "200", purchasedAt: "2027-01-01" }), 1.5, today);
  assert.equal(future.ok, false);
  const blankDate = parseHoldingForm(fd({ ...ohtani, purchasePrice: "200" }), 1.5, today);
  assert.ok(blankDate.ok && blankDate.value.purchasedAt === "2026-10-10");
});

test("settings form turns percentages into fractions", () => {
  const r = parseSettingsForm(
    fd({ usdToAud: "1.55", feePercent: "13.25", fixedFee: "0.4", outboundShipping: "5", importTaxPercent: "10", otherCosts: "2", minRoi: "25", minProfit: "30" }),
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.marketplaceFeeRate, 0.1325);
  assert.equal(r.value.importTaxRate, 0.1);
  assert.equal(r.value.minRoiPercent, 25);
  assert.equal(r.value.usdToAud, 1.55);
  const bad = parseSettingsForm(fd({ usdToAud: "0", feePercent: "13", fixedFee: "0", outboundShipping: "0", importTaxPercent: "0", otherCosts: "0", minRoi: "0", minProfit: "0" }));
  assert.equal(bad.ok, false);
});

test("session token is stable, password-specific and hex", async () => {
  const a = await sessionToken("hunter2");
  assert.equal(a, await sessionToken("hunter2"));
  assert.notEqual(a, await sessionToken("hunter3"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("login redirect only allows paths inside the app", () => {
  assert.equal(safeNextPath("/watchlist"), "/watchlist");
  assert.equal(safeNextPath("//evil.com"), "/");
  assert.equal(safeNextPath("https://evil.com"), "/");
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath("/login"), "/");
});
