/**
 * Runs every active saved search: eBay → de-duplicate → value → score → save → email.
 * Called by the scheduled endpoint (/api/cron/scan) and the "Scan now" button.
 */
import { ebayConfigured, searchListings } from "@/lib/ebay/client";
import { alertEmailHtml, emailConfigured, sendAlertEmail } from "@/lib/email";
import { parseExcludeWords } from "@/lib/exclude";
import { dealsMessage, pushToAllDevices } from "./notify";
import { evaluateListing, shouldAlert, type ScanHit } from "@/lib/scan";
import {
  cardValueMap,
  existingItemIds,
  insertHits,
  listSavedSearches,
  loadSettings,
  markSearchRun,
  recordScanRun,
} from "./db";

export interface ScanSummary {
  searches: number;
  newListings: number;
  deals: number;
  emailed: number;
  pushed: number;
  errors: string[];
}

const MAX_EMAIL_ROWS = 15;

export async function runAllScans(trigger: "schedule" | "manual" | "daily"): Promise<ScanSummary> {
  const summary: ScanSummary = { searches: 0, newListings: 0, deals: 0, emailed: 0, pushed: 0, errors: [] };
  if (!ebayConfigured()) {
    summary.errors.push("eBay isn't connected.");
    return summary;
  }

  const [{ settings }, searches, values] = await Promise.all([loadSettings(), listSavedSearches(), cardValueMap()]);
  if (searches.error) {
    summary.errors.push(`Saved searches: ${searches.error}`);
    await recordScanRun({ trigger, searches: 0, newListings: 0, deals: 0, emailed: 0, error: summary.errors.join("; ") });
    return summary;
  }

  const toEmail: (ScanHit & { searchName: string })[] = [];

  for (const s of searches.data.filter((x) => x.active)) {
    summary.searches++;
    const r = await searchListings({ q: s.query, market: s.market, category: s.category, maxPrice: s.maxPrice, format: s.format, limit: 50, exclude: parseExcludeWords(s.excludeWords) });
    if (!r.ok) {
      summary.errors.push(`${s.name}: ${r.error}`);
      await markSearchRun(s.id, `Error: ${r.error}`);
      if (r.code === 429) break; // daily eBay limit — stop for now
      continue;
    }
    try {
      const seen = await existingItemIds(s.id, r.data.items.map((i) => i.itemId));
      const fresh = r.data.items.filter((i) => !seen.has(i.itemId));
      const hits = fresh.map((l) => {
        const h = evaluateListing(l, settings, values.map);
        return { ...h, alerted: shouldAlert(h) };
      });
      await insertHits(s.id, hits);
      const deals = hits.filter((h) => h.meetsCriteria);
      summary.newListings += hits.length;
      summary.deals += deals.length;
      hits.filter((h) => h.alerted).forEach((h) => toEmail.push({ ...h, searchName: s.name }));
      await markSearchRun(s.id, `OK · ${hits.length} new · ${deals.length} deal${deals.length === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${s.name}: ${msg}`);
      await markSearchRun(s.id, `Error: ${msg}`);
    }
  }

  if (toEmail.length > 0 && emailConfigured()) {
    const best = toEmail.sort((a, b) => (b.roiPercent ?? 0) - (a.roiPercent ?? 0)).slice(0, MAX_EMAIL_ROWS);
    const appUrl = process.env.APP_URL ?? "https://cardscout-ai.vercel.app";
    const err = await sendAlertEmail(
      `CardScout: ${toEmail.length} new deal${toEmail.length === 1 ? "" : "s"}`,
      alertEmailHtml(best, settings.usdToAud, appUrl),
    );
    if (err) summary.errors.push(err);
    else summary.emailed = best.length;
  }

  // Phone notifications for the same alert-worthy deals as the email.
  if (toEmail.length > 0) {
    const p = await pushToAllDevices(dealsMessage(toEmail));
    summary.pushed = p.sent;
    summary.errors.push(...p.errors);
  }

  await recordScanRun({
    trigger,
    searches: summary.searches,
    newListings: summary.newListings,
    deals: summary.deals,
    emailed: summary.emailed,
    error: summary.errors.length ? summary.errors.join("; ").slice(0, 500) : null,
  });
  return summary;
}
