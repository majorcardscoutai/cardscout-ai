import { test } from "node:test";
import assert from "node:assert/strict";
import { batches, csvToProducts, dollarsToPennies, guideDownloadUrl, parseCsv, parseGuideLink } from "../src/lib/guide-csv.js";
import { pickProduct } from "../src/lib/provider.js";
import type { CardIdentity } from "../src/lib/types.js";

test("pasted link: keeps the set code and site, never the token", () => {
  const r = parseGuideLink("https://www.sportscardspro.com/price-guide/download-custom?t=SECRET123&console-uids=G23347");
  assert.deepEqual(r, { ok: true, host: "sportscardspro", uids: ["G23347"] });
  assert.doesNotMatch(JSON.stringify(r), /SECRET123/);
  const two = parseGuideLink("https://www.pricecharting.com/price-guide/download-custom?t=x&console-uids=G1,g2, G1");
  assert.deepEqual(two, { ok: true, host: "pricecharting", uids: ["G1", "G2"] });
  assert.deepEqual(parseGuideLink(" g23347 "), { ok: true, host: "sportscardspro", uids: ["G23347"] });
  for (const [bad, re] of [["", /Paste/], ["https://evil.com/x?console-uids=G1", /isn't from SportsCardsPro/], ["https://www.sportscardspro.com/price-guide/download-custom?t=x", /no set in it/], ["hello", /isn't a link/]] as const) {
    const b = parseGuideLink(bad); assert.equal(b.ok, false); if (!b.ok) assert.match(b.error, re);
  }
  const u = new URL(guideDownloadUrl("sportscardspro", ["G1", "G2", "G3", "G4", "G5", "G6"], "tok"));
  assert.equal(u.searchParams.get("console-uids"), "G1,G2,G3,G4,G5", "max 5 per request");
  assert.deepEqual(batches([1, 2, 3, 4, 5, 6, 7]), [[1, 2, 3, 4, 5], [6, 7]]);
});

test("CSV reading: quotes, commas, dollars, same shape as the API", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\r\n1,\n'), [["a", "b"], ["x, y", 'he said "hi"'], ["1", ""]]);
  assert.equal(dollarsToPennies("$21.99"), 2199); assert.equal(dollarsToPennies("$1,234.50"), 123450); assert.equal(dollarsToPennies(""), null);
  const csv = [
    "id,console-name,product-name,loose-price,cib-price,new-price,graded-price,box-only-price,manual-only-price,bgs-10-price,retail-loose-buy,sales-volume,release-date",
    '1558869,Baseball Cards 2018 Topps Update,Shohei Ohtani #US1,$159.78,,$180.00,$244.80,$300.00,$699.59,$900.00,$100.00,1447,2018-10-22',
    '1558870,Baseball Cards 2018 Topps Update,"Shohei Ohtani [Gold] #US1",$400.00,,,,,"$2,500.00",,,12,2018-10-22',
    "1558871,Baseball Cards 2018 Topps Update,Team Card,,,,,,,,,,",
  ].join("\n");
  const r = csvToProducts(csv);
  assert.equal(r.error, null); assert.deepEqual(r.consoles, ["Baseball Cards 2018 Topps Update"]); assert.equal(r.products.length, 3);
  const p = r.products[0];
  assert.deepEqual(p.prices, { "loose-price": 15978, "new-price": 18000, "graded-price": 24480, "box-only-price": 30000, "manual-only-price": 69959, "bgs-10-price": 90000 });
  assert.equal(p.salesVolume, 1447); assert.equal(p.numberNorm, "us1");
  assert.equal(r.products[1].prices["manual-only-price"], 250000);
  assert.equal(r.products[2].numberNorm, null);
  // same exact-match rules as API products
  const card = { sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update", cardNumber: "US1", grader: "PSA", grade: 10 } as CardIdentity;
  const pick = pickProduct(card, r.products);
  assert.ok(pick.ok); if (pick.ok) assert.equal(pick.product.id, "1558869", "base, not Gold");
  assert.match(csvToProducts("<!doctype html><html>login</html>").error ?? "", /web page/);
});

test("several Download Price List links at once", async () => {
  const { parseGuideLinks } = await import("../src/lib/guide-csv.js");
  const r = parseGuideLinks(`https://www.pricecharting.com/price-guide/download-custom?t=SECRET&console-uids=G100
https://www.pricecharting.com/price-guide/download-custom?t=SECRET&console-uids=G101   https://www.sportscardspro.com/price-guide/download-custom?t=SECRET&console-uids=G23347
https://www.pricecharting.com/price-guide/download-custom?t=SECRET&console-uids=G100
not-a-link https://example.com/x?console-uids=G9`);
  assert.deepEqual(r.sets.get("pricecharting"), ["G100", "G101"]);
  assert.deepEqual(r.sets.get("sportscardspro"), ["G23347"]);
  assert.equal(r.errors.length, 2);
  assert.doesNotMatch(r.errors.join(" "), /SECRET/, "tokens never echoed");
});
