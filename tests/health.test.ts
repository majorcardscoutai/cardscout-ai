import { test } from "node:test";
import assert from "node:assert/strict";
import { healthReport } from "../src/lib/health";

const now = Date.parse("2026-10-30T00:00:00Z");
const ago = (m: number) => new Date(now - m * 60_000).toISOString();
const run = (trigger: string, m: number, error: string | null = null) => ({ trigger, createdAt: ago(m), error });

test("healthy: Hunter within 30 min, scan within 4 h", () => {
  const h = healthReport([run("hunter", 8), run("schedule", 95), run("hunter", 18)], now);
  assert.deepEqual(h, { ok: true, problems: [], hunterAgeMin: 8, scanAgeMin: 95 });
});

test("late or missing runs are problems", () => {
  const h = healthReport([run("hunter", 47), run("daily", 300)], now);
  assert.equal(h.ok, false);
  assert.match(h.problems.join(" | "), /Profit Hunter hasn't run for 47 minutes/);
  assert.match(h.problems.join(" | "), /haven't run for 5 hours/);
  assert.deepEqual(healthReport([], now).problems, ["No Profit Hunter run recorded.", "No saved-search scan recorded."]);
});

test("one failure is a blip; repeated failures are a problem", () => {
  assert.equal(healthReport([run("hunter", 5, "eBay 500"), run("hunter", 15), run("schedule", 30)], now).ok, true);
  const bad = healthReport([run("hunter", 5, "eBay 429"), run("hunter", 15, "eBay 429"), run("hunter", 25, "eBay 429"), run("schedule", 30, "x"), run("schedule", 210, "x")], now);
  assert.match(bad.problems.join(" | "), /Last 3 Profit Hunter runs failed: eBay 429/);
  assert.match(bad.problems.join(" | "), /Last 2 saved-search scans failed/);
});
