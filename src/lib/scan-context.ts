/**
 * Who scheduled work is running for (Phase 6 step 5). Server only, no Next.js imports, so the eBay and
 * price-guide clients can count calls against the right account.
 *  - userId: a scheduled scan running as that account
 *  - scope "shared": work done once for everyone (the shared Profit Hunter search)
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const scanContext = new AsyncLocalStorage<{ userId?: string; scope: string }>();

/** Usage scope for the current work: an account id, "shared", or "app" (someone using a page). */
export function usageScope(): string {
  return scanContext.getStore()?.scope ?? "app";
}

// ---------- API call counts (for the Admin page) ----------
export interface UsageCount {
  ebay: number;
  guide: number;
}
const counts = new Map<string, UsageCount>();

export function countCall(kind: "ebay" | "guide"): void {
  const k = usageScope();
  const c = counts.get(k) ?? { ebay: 0, guide: 0 };
  c[kind]++;
  counts.set(k, c);
}

/** Take (and reset) the counts gathered so far. */
export function takeUsage(): Map<string, UsageCount> {
  const out = new Map(counts);
  counts.clear();
  return out;
}
