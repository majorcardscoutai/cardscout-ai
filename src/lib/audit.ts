/**
 * Deal accuracy: of the deals CardHawk showed, how many were real when checked by hand?
 * precision = good / (good + bad) — "unsure" doesn't count either way. Target before charging: 90%+.
 */
export type Verdict = "good" | "bad" | "unsure";

export const AUDIT_REASONS = [
  "Wrong card or set",
  "Wrong parallel",
  "Wrong grade or grader",
  "Guide value wrong (odd sale)",
  "Not English",
  "Damaged / altered / not as described",
  "Other",
] as const;

export interface AuditRow {
  itemId: string;
  verdict: Verdict;
  reason: string | null;
  needsCheck: boolean;
  createdAt: string;
}

export interface WeekStats {
  /** Monday of the week (YYYY-MM-DD, UTC). */
  week: string;
  good: number;
  bad: number;
  unsure: number;
  /** null when nothing was judged good or bad. */
  precision: number | null;
}

export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Weekly precision, newest week first. Listings held for "needs a manual check" are left out (they were never shown as deals). */
export function weeklyPrecision(rows: AuditRow[]): WeekStats[] {
  const by = new Map<string, WeekStats>();
  for (const r of rows) {
    if (r.needsCheck) continue;
    const w = weekStart(r.createdAt);
    const s = by.get(w) ?? { week: w, good: 0, bad: 0, unsure: 0, precision: null };
    s[r.verdict]++;
    by.set(w, s);
  }
  return [...by.values()]
    .map((s) => ({ ...s, precision: s.good + s.bad > 0 ? Math.round((s.good / (s.good + s.bad)) * 1000) / 10 : null }))
    .sort((a, b) => b.week.localeCompare(a.week));
}

/** Most common reasons deals were wrong — tells you which rule to fix next. */
export function topReasons(rows: AuditRow[]): [string, number][] {
  const c = new Map<string, number>();
  for (const r of rows) if (r.verdict === "bad") c.set(r.reason ?? "Other", (c.get(r.reason ?? "Other") ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}
