/**
 * Is automatic scanning actually running? Pure logic (tested) — the data comes from scan_runs.
 * Used by /api/cron/health (checked by an outside monitor, so it still works if GitHub's scheduler stops)
 * and the Admin page.
 */
export interface RunRow {
  trigger: string;
  createdAt: string;
  error: string | null;
}

export interface HealthReport {
  ok: boolean;
  problems: string[];
  /** Minutes since the last Profit Hunter run (null = none recorded). */
  hunterAgeMin: number | null;
  /** Minutes since the last saved-search scan (null = none recorded). */
  scanAgeMin: number | null;
}

/** The Hunter is triggered every 10 minutes; allow for GitHub's usual delays before calling it late. */
export const HUNTER_LATE_MIN = 30;
/** Saved searches run every 3 hours. */
export const SCAN_LATE_MIN = 4 * 60;

const mins = (now: number, iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

export function healthReport(runs: RunRow[], now = Date.now()): HealthReport {
  const sorted = [...runs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const hunter = sorted.filter((r) => r.trigger === "hunter");
  const scans = sorted.filter((r) => r.trigger === "schedule" || r.trigger === "daily");
  const problems: string[] = [];

  const hunterAgeMin = hunter[0] ? mins(now, hunter[0].createdAt) : null;
  const scanAgeMin = scans[0] ? mins(now, scans[0].createdAt) : null;

  if (hunterAgeMin === null) problems.push("No Profit Hunter run recorded.");
  else if (hunterAgeMin > HUNTER_LATE_MIN) problems.push(`Profit Hunter hasn't run for ${hunterAgeMin} minutes (expected every 10).`);
  if (scanAgeMin === null) problems.push("No saved-search scan recorded.");
  else if (scanAgeMin > SCAN_LATE_MIN) problems.push(`Saved-search scans haven't run for ${Math.round(scanAgeMin / 60)} hours (expected every 3).`);

  // One failed run can be a blip; three in a row is a real problem.
  const lastHunters = hunter.slice(0, 3);
  if (lastHunters.length === 3 && lastHunters.every((r) => r.error)) problems.push(`Last 3 Profit Hunter runs failed: ${lastHunters[0].error}`);
  if (scans[0]?.error && scans[1]?.error) problems.push(`Last 2 saved-search scans failed: ${scans[0].error}`);

  return { ok: problems.length === 0, problems, hunterAgeMin, scanAgeMin };
}
