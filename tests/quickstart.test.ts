import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/config";
import { budgetUsd, parseQuickStart, quickStartHunter, quickStartSettings, starterSearches } from "../src/lib/quickstart";

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

test("parses the three steps and rejects gaps", () => {
  const ok = parseQuickStart(form({ region: "AU", s_MLB: "on", s_Pokemon: "on", budget: "500", choosy: "strict" }));
  assert.deepEqual(ok, { ok: true, value: { region: "AU", sports: ["MLB", "Pokemon"], budget: 500, choosy: "strict" } });
  assert.equal(parseQuickStart(form({ s_MLB: "on", budget: "500" })).ok, false);
  assert.match((parseQuickStart(form({ region: "US", budget: "500" })) as { error: string }).error, /Tick at least one/);
  assert.equal(parseQuickStart(form({ region: "US", s_NBA: "on", budget: "999" })).ok, false);
  const def = parseQuickStart(form({ region: "US", s_NBA: "on", budget: "150" }));
  assert.equal(def.ok && def.value.choosy, "balanced");
});

test("A$ budget converted to US$ for the Hunter; sensible minimum price", () => {
  assert.equal(budgetUsd({ region: "AU", budget: 500 }, 1.5), 333);
  assert.equal(budgetUsd({ region: "US", budget: 500 }, 1.5), 500);
  const h = quickStartHunter({ region: "AU", sports: ["NBA"], budget: 1500, choosy: "balanced" }, 1.5);
  assert.deepEqual([h.enabled, h.sports, h.budget, h.minPrice, h.market], [true, ["NBA"], 1000, 50, "EBAY_US"]);
  assert.equal(quickStartHunter({ region: "US", sports: ["MLB"], budget: 150, choosy: "more" }, 1.5).minPrice, 15);
});

test("settings: region + rules; tax only set on a first-time setup", () => {
  const s = quickStartSettings({ ...DEFAULT_SETTINGS, importTaxRate: 0.07 }, { region: "US", sports: ["MLB"], budget: 500, choosy: "strict" }, false);
  assert.deepEqual([s.buyerRegion, s.importTaxRate, s.minRoiPercent, s.minProfitUsd], ["US", 0.07, 25, 40]);
  assert.equal(quickStartSettings(DEFAULT_SETTINGS, { region: "US", sports: ["MLB"], budget: 500, choosy: "balanced" }, true).importTaxRate, 0.08);
});

test("starter searches: one per sport, PSA 10, under budget, within the plan's room", () => {
  const q = { region: "AU" as const, sports: ["MLB", "NBA", "Pokemon"] as ("MLB" | "NBA" | "Pokemon")[], budget: 500, choosy: "balanced" as const };
  const all = starterSearches(q, 1.5, 3);
  assert.deepEqual(all.map((s) => [s.name, s.category, s.grading, s.maxPrice]), [
    ["Baseball PSA 10 rookies", "sportsCards", "psa", 333],
    ["Basketball PSA 10 rookies", "sportsCards", "psa", 333],
    ["Pokémon PSA 10", "pokemon", "psa", 333],
  ]);
  assert.equal(starterSearches(q, 1.5, 1).length, 1);
  assert.equal(starterSearches(q, 1.5, 0).length, 0);
});
