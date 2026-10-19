/**
 * Popular sets: download the price lists of the sets YOU chose (Settings → Popular sets) once a day,
 * keep them in guide_prices, and value cards from those sets instantly — no 1-call-per-second lookups.
 * Cards from other sets still use the API lookups. Same exact-match rules either way.
 */
import { batches, csvToProducts, GUIDE_REFRESH_MS, type GuideHost } from "@/lib/guide-csv";
import type { ProviderProduct } from "@/lib/provider";
import { downloadGuideCsv, providerConfigured } from "@/lib/provider-client";
import { guidePricesByNumber, listGuideSets, markGuideSet, saveGuidePrices, type GuideSet } from "./db";

export interface GuideRefresh {
  requests: number;
  setsUpdated: number;
  rows: number;
  errors: string[];
}

/** Refresh sets older than a day (new ones first), within the time budget. */
export async function refreshGuideSets(opts: { deadline: number; maxRequests?: number; only?: string[] }): Promise<GuideRefresh> {
  const out: GuideRefresh = { requests: 0, setsUpdated: 0, rows: 0, errors: [] };
  if (!providerConfigured()) return out;
  const sets = await listGuideSets();
  if (sets.error) {
    if (!/guide_sets/.test(sets.error)) out.errors.push(`Popular sets: ${sets.error}`);
    return out;
  }
  const now = Date.now();
  const due = sets.data
    .filter((s) => (opts.only ? opts.only.includes(s.uid) : true))
    .filter((s) => opts.only || !s.downloadedAt || now - new Date(s.downloadedAt).getTime() > GUIDE_REFRESH_MS || s.error)
    .sort((a, b) => (a.downloadedAt ?? "").localeCompare(b.downloadedAt ?? ""));
  // A set we haven't named yet is downloaded on its own (so we learn its name); known sets go 5 at a time.
  const requests: { host: GuideHost; sets: GuideSet[] }[] = [];
  for (const s of due.filter((x) => !x.name)) requests.push({ host: s.host, sets: [s] });
  for (const host of ["sportscardspro", "pricecharting"] as GuideHost[])
    for (const group of batches(due.filter((x) => x.name && x.host === host))) requests.push({ host, sets: group });

  for (const req of requests) {
    if (Date.now() > opts.deadline || out.requests >= (opts.maxRequests ?? 4)) break;
    out.requests++;
    const r = await downloadGuideCsv(req.host, req.sets.map((s) => s.uid));
    if (!r.ok) {
      for (const s of req.sets) await markGuideSet(s.uid, { error: r.error });
      out.errors.push(`Popular sets: ${r.error}`);
      if (r.code === 429 || r.code === 401 || r.code === 403) break;
      continue;
    }
    const parsed = csvToProducts(r.data);
    if (parsed.error) {
      for (const s of req.sets) await markGuideSet(s.uid, { error: parsed.error });
      out.errors.push(`Popular sets: ${parsed.error}`);
      continue;
    }
    // Which rows belong to which set: a single-set download is all one set; otherwise match by set name.
    const byName = new Map(req.sets.filter((s) => s.name).map((s) => [s.name!, s.uid]));
    const uidFor = (consoleName: string) => (req.sets.length === 1 ? req.sets[0].uid : byName.get(consoleName));
    const rows = parsed.products
      .map((p) => ({ p, uid: uidFor(p.consoleName) }))
      .filter((x): x is { p: (typeof parsed.products)[number]; uid: string } => !!x.uid)
      .map(({ p, uid }) => ({ productId: p.id, setUid: uid, consoleName: p.consoleName, productName: p.productName, numberNorm: p.numberNorm, prices: p.prices, salesVolume: p.salesVolume }));
    const err = await saveGuidePrices(rows);
    if (err) {
      out.errors.push(/guide_prices/.test(err) ? "Popular sets need the one-time SQL update (see PROGRESS.md)." : `Popular sets: ${err}`);
      break;
    }
    out.rows += rows.length;
    for (const s of req.sets) {
      const mine = rows.filter((x) => x.setUid === s.uid);
      await markGuideSet(s.uid, { name: s.name ?? mine[0]?.consoleName ?? null, rows: mine.length, downloaded: true });
      if (mine.length > 0) out.setsUpdated++;
    }
  }
  return out;
}

/** Products from your downloaded sets, grouped by normalised card number. */
export async function localGuide(numbers: string[]): Promise<Map<string, ProviderProduct[]>> {
  const map = new Map<string, ProviderProduct[]>();
  const r = await guidePricesByNumber(numbers.filter(Boolean));
  for (const g of r.data) {
    if (!g.numberNorm) continue;
    const list = map.get(g.numberNorm) ?? [];
    list.push({ id: g.productId, productName: g.productName, consoleName: g.consoleName, prices: g.prices, salesVolume: g.salesVolume });
    map.set(g.numberNorm, list);
  }
  return map;
}
