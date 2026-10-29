import { test } from "node:test";
import assert from "node:assert/strict";
import { topReasons, weekStart, weeklyPrecision, type AuditRow } from "../src/lib/audit";

const row = (createdAt: string, verdict: AuditRow["verdict"], reason: string | null = null, needsCheck = false): AuditRow => ({ itemId: createdAt + verdict + reason, verdict, reason, needsCheck, createdAt });

test("weeks start on Monday (UTC)", () => {
  assert.equal(weekStart("2026-10-30T03:00:00Z"), "2026-10-26"); // Friday → Monday
  assert.equal(weekStart("2026-10-26T00:00:00Z"), "2026-10-26");
  assert.equal(weekStart("2026-11-01T23:00:00Z"), "2026-10-26"); // Sunday
});

test("weekly precision = real / (real + wrong); unsure and held listings don't count", () => {
  const rows = [
    row("2026-10-27T01:00:00Z", "good"), row("2026-10-28T01:00:00Z", "good"), row("2026-10-28T02:00:00Z", "good"),
    row("2026-10-29T01:00:00Z", "bad", "Wrong parallel"), row("2026-10-29T02:00:00Z", "unsure"),
    row("2026-10-29T03:00:00Z", "bad", "Guide value wrong (odd sale)", true),
    row("2026-10-20T01:00:00Z", "bad", "Wrong parallel"),
  ];
  const w = weeklyPrecision(rows);
  assert.deepEqual(w[0], { week: "2026-10-26", good: 3, bad: 1, unsure: 1, precision: 75 });
  assert.deepEqual(w[1], { week: "2026-10-19", good: 0, bad: 1, unsure: 0, precision: 0 });
  assert.deepEqual(topReasons(rows), [["Wrong parallel", 2], ["Guide value wrong (odd sale)", 1]]);
  assert.deepEqual(weeklyPrecision([row("2026-10-29T02:00:00Z", "unsure")])[0].precision, null);
});
