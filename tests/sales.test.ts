import { test } from "node:test";
import assert from "node:assert/strict";
import { cardSearchText, certFromAspects, certLookupUrl, compareCert, ebaySoldUrl, guideSearchUrl, psaGradeNumber } from "../src/lib/sales.js";
import { parsePsaCert } from "../src/lib/psa.js";
import type { CardIdentity } from "../src/lib/types.js";

const ohtani: Partial<CardIdentity> = { sport: "MLB", player: "Shohei Ohtani", year: 2018, set: "Topps Update", cardNumber: "US1", grader: "PSA", grade: 10 };

test("recent-sales links search the exact card", () => {
  assert.equal(cardSearchText(ohtani), "2018 Topps Update Shohei Ohtani #US1 PSA 10");
  assert.equal(cardSearchText({ ...ohtani, set: "2018 Topps Update" }), "2018 Topps Update Shohei Ohtani #US1 PSA 10", "year not repeated");
  const u = new URL(ebaySoldUrl(ohtani, "EBAY_AU"));
  assert.equal(u.host, "www.ebay.com.au");
  assert.equal(u.searchParams.get("_nkw"), "2018 Topps Update Shohei Ohtani #US1 PSA 10");
  assert.equal(u.searchParams.get("LH_Sold"), "1"); assert.equal(u.searchParams.get("LH_Complete"), "1"); assert.equal(u.searchParams.get("_sacat"), "261328");
  const zard = { sport: "Pokemon", player: "Charizard", year: 2016, set: "Evolutions", cardNumber: "11/108", parallel: "Reverse Holo", grader: "PSA", grade: 9 } as Partial<CardIdentity>;
  assert.equal(new URL(ebaySoldUrl(zard, "EBAY_US")).searchParams.get("_sacat"), "183454");
  assert.equal(cardSearchText(zard), "Evolutions Charizard Reverse Holo #11/108 PSA 9");
  const g = guideSearchUrl(zard); assert.equal(g.label, "PriceCharting"); assert.match(g.url, /^https:\/\/www\.pricecharting\.com\/search-products\?q=Evolutions/);
  assert.equal(guideSearchUrl(ohtani).label, "SportsCardsPro"); assert.doesNotMatch(guideSearchUrl(ohtani).url, /PSA/, "guide search covers all grades");
  assert.equal(new URL(ebaySoldUrl({}, "EBAY_US", "vague title")).searchParams.get("_nkw"), "vague title");
});

test("cert number from item specifics + lookup pages", () => {
  assert.equal(certFromAspects([{ name: "Certification Number", value: "84512345" }]), "84512345");
  assert.equal(certFromAspects([{ name: "Cert Number", value: "#  101 234 567" }]), "101234567");
  assert.equal(certFromAspects([{ name: "Grade", value: "10" }]), null);
  assert.equal(certFromAspects([{ name: "Certification Number", value: "N/A" }]), null);
  assert.equal(certLookupUrl("PSA", "84512345"), "https://www.psacard.com/cert/84512345");
  assert.equal(certLookupUrl("BGS", "1"), null);
});

test("PSA record parsed; grade, number, year and player must agree", () => {
  const c = parsePsaCert({ PSACert: { CertNumber: "84512345", Year: "2018", Brand: "TOPPS UPDATE", Subject: "SHOHEI OHTANI", CardNumber: "US1", Variety: "", CardGrade: "GEM MT 10", TotalPopulation: 15234, PopulationHigher: 0 } });
  assert.ok(c);
  assert.equal(c!.subject, "SHOHEI OHTANI"); assert.equal(c!.variety, null); assert.equal(c!.population, 15234);
  assert.equal(psaGradeNumber("GEM MT 10"), 10); assert.equal(psaGradeNumber("NM-MT 8"), 8); assert.equal(psaGradeNumber("MINT 9 (OC)"), 9); assert.equal(psaGradeNumber("AUTHENTIC"), null);
  assert.deepEqual(compareCert(ohtani, c!), { matches: true, issues: [] });
  assert.match(compareCert({ ...ohtani, grade: 9 }, c!).issues[0], /Listing says PSA 9, but PSA's record says GEM MT 10/);
  assert.equal(compareCert({ ...ohtani, cardNumber: "US2" }, c!).matches, false);
  assert.equal(compareCert({ ...ohtani, player: "Mike Trout" }, c!).matches, false);
  assert.equal(compareCert({ ...ohtani, year: 2019 }, c!).matches, false);
  assert.equal(parsePsaCert({ DNACert: {} }), null);
  assert.equal(parsePsaCert(null), null);
});
