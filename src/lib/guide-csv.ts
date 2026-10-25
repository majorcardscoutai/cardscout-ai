/**
 * SportsCardsPro / PriceCharting "Download Price List" CSV — pure helpers (no network).
 *
 * SportsCardsPro (JJ Hendricks, 20 Oct 2026): up to 5 console-uids per request; no list of uids is
 * provided; downloads are meant for particular sets, not the whole database. So CardHawk only
 * downloads the sets YOU add (Settings → Popular sets), at most once a day.
 */
import { normNumber, parseProductName, type ProviderProduct } from "./provider";

export const MAX_UIDS_PER_REQUEST = 5;
export const MAX_GUIDE_SETS = 60;
export const GUIDE_REFRESH_MS = 24 * 3_600_000;

export type GuideHost = "sportscardspro" | "pricecharting";
export const GUIDE_HOSTS: Record<GuideHost, string> = {
  sportscardspro: "https://www.sportscardspro.com",
  pricecharting: "https://www.pricecharting.com",
};

/**
 * Read a pasted "Download Price List" link. Keeps ONLY the site and set code(s) — the token in the
 * link (t=…) is never kept; downloads use SPORTSCARDSPRO_TOKEN from Vercel.
 */
export function parseGuideLink(raw: string): { ok: true; host: GuideHost; uids: string[] } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste a set's “Download Price List” link." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    // A bare set code like "G23347" is fine too.
    if (/^[A-Z]{0,3}\d{1,10}$/i.test(text)) return { ok: true, host: "sportscardspro", uids: [text.toUpperCase()] };
    return { ok: false, error: "That isn't a link. Right-click “Download Price List” on the set page → Copy Link Address." };
  }
  const host: GuideHost | null = /(^|\.)sportscardspro\.com$/i.test(url.hostname)
    ? "sportscardspro"
    : /(^|\.)pricecharting\.com$/i.test(url.hostname)
      ? "pricecharting"
      : null;
  if (!host) return { ok: false, error: "That link isn't from SportsCardsPro or PriceCharting." };
  const uids = (url.searchParams.get("console-uids") ?? "")
    .split(",")
    .map((u) => u.trim().toUpperCase())
    .filter((u) => /^[A-Z]{0,3}\d{1,10}$/.test(u));
  if (uids.length === 0)
    return { ok: false, error: "That link has no set in it — use the “Download Price List” link on a specific set's page." };
  return { ok: true, host, uids: [...new Set(uids)] };
}

/**
 * Several pasted links at once (one per line, or separated by spaces). Returns the set codes per site
 * and a note for each line that couldn't be read. A bare set code ("G23347") counts as SportsCardsPro.
 */
export function parseGuideLinks(raw: string): { sets: Map<GuideHost, string[]>; errors: string[] } {
  const sets = new Map<GuideHost, string[]>();
  const errors: string[] = [];
  const parts = raw.split(/\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 100);
  for (const part of parts) {
    const r = parseGuideLink(part);
    if (!r.ok) {
      const shown = part.replace(/([?&])t=[^&]*/gi, "$1t=…");
      errors.push(`${shown.length > 70 ? shown.slice(0, 67) + "…" : shown}: ${r.error}`);
      continue;
    }
    const list = sets.get(r.host) ?? [];
    for (const u of r.uids) if (!list.includes(u)) list.push(u);
    sets.set(r.host, list);
  }
  return { sets, errors };
}

/** The download URL for up to 5 sets (token added at request time, never stored). */
export function guideDownloadUrl(host: GuideHost, uids: string[], token: string): string {
  const qs = new URLSearchParams({ t: token, "console-uids": uids.slice(0, MAX_UIDS_PER_REQUEST).join(",") });
  return `${GUIDE_HOSTS[host]}/price-guide/download-custom?${qs}`;
}

/** Split into requests of at most 5 set codes. */
export function batches<T>(items: T[], size = MAX_UIDS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/** "$21.99" → 2199 (pennies, like the API); blank → null. */
export function dollarsToPennies(v: string | undefined): number | null {
  const t = (v ?? "").replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export type GuideProduct = ProviderProduct & { numberNorm: string | null };

/** CSV text → products in the same shape the API gives (so the same exact-match rules apply). */
export function csvToProducts(text: string): { products: GuideProduct[]; consoles: string[]; error: string | null } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { products: [], consoles: [], error: "The download was empty." };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iId = col("id");
  const iConsole = col("console-name");
  const iName = col("product-name");
  if (iId < 0 || iConsole < 0 || iName < 0) {
    const looksHtml = /<html|<!doctype/i.test(text.slice(0, 500));
    return { products: [], consoles: [], error: looksHtml ? "SportsCardsPro sent a web page instead of a price list (check the token/subscription)." : "Unexpected price list format." };
  }
  const priceCols = head.map((h, i) => ({ h, i })).filter(({ h }) => h.endsWith("-price") && !h.startsWith("retail-"));
  const iSales = col("sales-volume");
  const products: GuideProduct[] = [];
  const consoles = new Set<string>();
  for (const r of rows.slice(1)) {
    const id = (r[iId] ?? "").trim();
    const productName = (r[iName] ?? "").trim();
    const consoleName = (r[iConsole] ?? "").trim();
    if (!id || !productName) continue;
    const prices: Record<string, number> = {};
    for (const { h, i } of priceCols) {
      const p = dollarsToPennies(r[i]);
      if (p !== null && p > 0) prices[h] = p;
    }
    const sv = iSales >= 0 ? Number((r[iSales] ?? "").replace(/,/g, "")) : NaN;
    const num = parseProductName(productName).number;
    consoles.add(consoleName);
    products.push({
      id,
      productName,
      consoleName,
      prices,
      salesVolume: Number.isFinite(sv) && (r[iSales] ?? "").trim() !== "" ? sv : null,
      numberNorm: num ? normNumber(num) : null,
    });
  }
  return { products, consoles: [...consoles], error: null };
}
