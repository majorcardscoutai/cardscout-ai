/** Page loader (components/NavProgress.tsx) — pure helpers. */

/**
 * Estimated loading progress. Pages don't report how far along they are, so the percentage climbs
 * quickly, slows down, waits at 95% and jumps to 100% the moment the page arrives.
 */
export function navProgress(elapsedMs: number): number {
  return Math.min(95, Math.round(95 * (1 - Math.exp(-Math.max(0, elapsedMs) / 1500))));
}

/** Should clicking this link show the loader? Only for pages inside CardHawk that aren't the one you're on. */
export function linkStartsLoad(a: { href: string; target: string; hasDownload: boolean; noProgress: boolean }, here: { origin: string; pathname: string; search: string }): boolean {
  if (a.noProgress || a.hasDownload || (a.target && a.target !== "_self")) return false;
  let url: URL;
  try {
    url = new URL(a.href, here.origin + here.pathname + here.search); // relative to the current page ("#top", "?sort=roi")
  } catch {
    return false;
  }
  if (url.origin !== here.origin) return false;
  if (url.pathname.startsWith("/api/")) return false; // file downloads (e.g. the waitlist CSV)
  return !(url.pathname === here.pathname && url.search === here.search); // same page / #section only
}
