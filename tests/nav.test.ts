import { test } from "node:test";
import assert from "node:assert/strict";
import { badge, hunterStatus, initialsFromEmail } from "../src/lib/nav";

const now = Date.parse("2026-10-29T01:00:00Z");
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

test("Hunter status pill: live, late, off, never run", () => {
  assert.deepEqual(hunterStatus(true, minsAgo(4), now), { tone: "gain", text: "Hunter live · checked 4 min ago" });
  assert.deepEqual(hunterStatus(true, minsAgo(0), now), { tone: "gain", text: "Hunter live · checked just now" });
  assert.deepEqual(hunterStatus(true, minsAgo(45), now), { tone: "warn", text: "Hunter last checked 45 min ago" });
  assert.deepEqual(hunterStatus(true, minsAgo(180), now), { tone: "warn", text: "Hunter last checked 3 h ago" });
  assert.deepEqual(hunterStatus(true, null, now), { tone: "warn", text: "Hunter on · no check yet" });
  assert.deepEqual(hunterStatus(false, minsAgo(4), now), { tone: "muted", text: "Profit Hunter is off" });
});

test("initials and badges", () => {
  assert.equal(initialsFromEmail("travis.major@hotmail.com"), "TM");
  assert.equal(initialsFromEmail("jj@example.com"), "JJ");
  assert.equal(initialsFromEmail("brady_smith99@x.com"), "BS");
  assert.equal(badge(0), null);
  assert.equal(badge(undefined), null);
  assert.equal(badge(7), "7");
  assert.equal(badge(140), "99+");
});
