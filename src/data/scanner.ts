/**
 * Runs every active saved search: eBay → de-duplicate → value → score → save → email.
 * Called by the scheduled endpoint (/api/cron/scan) and the "Scan now" button.
 */
import { ebayConfigured, getListing, searchListings } from "@/lib/ebay/client";
import { pickRechecks, recheckUpdate } from "@/lib/freshness";
import { alertEmailHtml, emailConfigured, sendAlertEmail } from "@/lib/email";
import { parseExcludeWords } from "@/lib/exclude";
import { displayFx, shipToFor } from "@/lib/region";
import { dealsMessage, pushToAllDevices } from "./notify";
import { evaluateListing, revalueHit, shouldAlert, type ScanHit } from "@/lib/scan";
import {
  cardValueMap,
  existingItemIds,
  insertHits,
  listRecentHits,
  markItemAlerted,
  listSavedSearches,
  loadSettings,
  markSearchRun,
  recordScanRun,
  updateHitsForItem,
} from "./db";

export interface ScanSummary {
  searches: number;
  newListings: number;
  deals: number;
  emailed: number;
  pushed: number;
  /** Listings re-checked on eBay this scan, and how many turned out sold/ended. */
  rechecked: number;
  ended: number;
  errors: string[];
}

const MAX_EMAIL_ROWS = 15;
/** Stop re-checking after this long so the whole scan fits in the 60-second limit. */
const RECHECK_TIME_BUDGET_MS = 40_000;

export async function runAllScans(trigger: "schedule" | "manual" | "daily"): Promise<ScanSummary> {
  const started = Date.now();
  const summary: ScanSummary = { searches: 0, newListings: 0, deals: 0, emailed: 0, pushed: 0, rechecked: 0, ended: 0, errors: [] };
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
    const r = await searchListings({ q: s.query, market: s.market, category: s.category, maxPrice: s.maxPrice, format: s.format, limit: 50, exclude: parseExcludeWords(s.excludeWords), shipTo: shipToFor(settings) });
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

  // Re-check valued listings on eBay so displayed details stay under 6 hours old
  // (eBay API licence §8.1.3), sold/ended listings drop out, and price drops can alert.
  try {
    const recent = await listRecentHits(1000);
    if (!recent.error) {
      const marketBySearch = new Map(searches.data.map((x) => [x.id, x.market]));
      const already = new Set(toEmail.map((h) => h.itemId));
      for (const h of pickRechecks(recent.data, settings, values.map)) {
        if (Date.now() - started > RECHECK_TIME_BUDGET_MS) break;
        const r = await getListing(h.itemId, marketBySearch.get(h.searchId) ?? "EBAY_US", shipToFor(settings));
        if (!r.ok && r.code === 429) break;
        if (!r.ok && r.code !== 404) continue; // temporary problem — try again next scan
        const u = recheckUpdate(r.ok ? r.data : null, settings.usdToAud);
        const err = await updateHitsForItem(h.itemId, u);
        if (err) {
          summary.errors.push(
            /checked_at|status/.test(err) ? "Listing re-check needs the one-time SQL update (see PROGRESS.md)." : `Re-check: ${err}`,
          );
          break;
        }
        summary.rechecked++;
        if (u.status === "ended") {
          summary.ended++;
          continue;
        }
        // A re-checked listing that now qualifies (e.g. the price dropped) alerts once.
        const now = revalueHit(
          { ...h, priceUsd: u.priceUsd ?? h.priceUsd, shippingUsd: u.shippingUsd ?? h.shippingUsd, endsAt: u.endsAt ?? h.endsAt, isAuction: u.isAuction ?? h.isAuction, title: u.title ?? h.title },
          settings,
          values.map,
        );
        const alertedBefore = recent.data.some((x) => x.itemId === h.itemId && x.alerted);
        if (!alertedBefore && !already.has(h.itemId) && shouldAlert(now)) {
          toEmail.push({ ...now, searchName: searches.data.find((x) => x.id === h.searchId)?.name ?? "Search" });
          already.add(h.itemId);
          await markItemAlerted(h.itemId);
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Re-check: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (toEmail.length > 0 && emailConfigured()) {
    const best = toEmail.sort((a, b) => (b.roiPercent ?? 0) - (a.roiPercent ?? 0)).slice(0, MAX_EMAIL_ROWS);
    const appUrl = process.env.APP_URL ?? "https://cardscout-ai.vercel.app";
    const err = await sendAlertEmail(
      `CardHawk: ${toEmail.length} new deal${toEmail.length === 1 ? "" : "s"}`,
      alertEmailHtml(best, displayFx(settings), appUrl),
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
