/** Menu (sidebar) helpers — pure, so they can be unit-tested. */

export interface NavCounts {
  /** Live deals that meet your rules (same list as Top Deals). */
  topDeals: number;
  /** Of those, how many the Profit Hunter found. */
  hunterDeals: number;
  /** Your own saved searches that are switched on (not the Hunter). */
  savedSearches: number;
  watchlist: number;
  hunter: HunterStatus;
}

export interface HunterStatus {
  tone: "gain" | "warn" | "muted";
  text: string;
}

const ago = (mins: number) => (mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`);

/**
 * The status pill at the bottom of the menu. The Hunter runs every 10 minutes, so anything over
 * 30 minutes since its last check is shown as a warning rather than "live".
 */
export function hunterStatus(enabled: boolean, lastRunAt: string | null, now = Date.now()): HunterStatus {
  if (!enabled) return { tone: "muted", text: "Profit Hunter is off" };
  if (!lastRunAt) return { tone: "warn", text: "Hunter on · no check yet" };
  const mins = Math.max(0, Math.round((now - new Date(lastRunAt).getTime()) / 60_000));
  if (mins > 30) return { tone: "warn", text: `Hunter last checked ${ago(mins)}` };
  return { tone: "gain", text: `Hunter live · checked ${ago(mins)}` };
}

/** "travis.major@hotmail.com" → "TM"; "jj@x.com" → "JJ". */
export function initialsFromEmail(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._\-+]+/).filter((p) => /[a-z]/i.test(p));
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Counts are shown only when there's something to count; big numbers are shortened. */
export function badge(n: number | undefined): string | null {
  if (!n || n <= 0) return null;
  return n > 99 ? "99+" : String(n);
}
