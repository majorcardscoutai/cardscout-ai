/**
 * SportsCardsPro / PriceCharting API client. Server-only (uses SPORTSCARDSPRO_TOKEN).
 * Their limit is 1 call per second — every call here waits its turn. Never throws.
 */
import { parseApiProduct, type ProviderProduct, type ProviderSite } from "./provider";
import { guideDownloadUrl, type GuideHost } from "./guide-csv";
import { countCall } from "./scan-context";

const HOSTS: Record<ProviderSite, string> = {
  sportscardspro: "https://www.sportscardspro.com",
  pricecharting: "https://www.pricecharting.com",
};
const MIN_GAP_MS = 1100;
let lastCall = 0;

export function providerConfigured(): boolean {
  return Boolean(process.env.SPORTSCARDSPRO_TOKEN);
}

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: number };

async function waitTurn() {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function get(site: ProviderSite, path: string, params: Record<string, string>): Promise<ProviderResult<Record<string, unknown>>> {
  const token = process.env.SPORTSCARDSPRO_TOKEN;
  if (!token) return { ok: false, error: "SportsCardsPro isn't connected (SPORTSCARDSPRO_TOKEN missing in Vercel)." };
  // Their docs show both hosts; try the site's own host first, then the other.
  const hosts = site === "sportscardspro" ? [HOSTS.sportscardspro, HOSTS.pricecharting] : [HOSTS.pricecharting, HOSTS.sportscardspro];
  let last: ProviderResult<Record<string, unknown>> = { ok: false, error: "No response." };
  for (const host of hosts) {
    await waitTurn();
    try {
      const qs = new URLSearchParams({ ...params, t: token });
      countCall("guide");
      const res = await fetch(`${host}${path}?${qs}`, { signal: AbortSignal.timeout(8000), cache: "no-store" } as RequestInit);
      if (res.status === 429) return { ok: false, code: 429, error: "SportsCardsPro rate limit reached — will continue next scan." };
      if (res.status === 401 || res.status === 403) return { ok: false, code: res.status, error: "SportsCardsPro rejected the token — check SPORTSCARDSPRO_TOKEN in Vercel." };
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !body) {
        last = { ok: false, code: res.status, error: `SportsCardsPro returned HTTP ${res.status}.` };
        continue;
      }
      if (body.status === "error") {
        const msg = String(body["error-message"] ?? "error");
        if (/token|subscription|access/i.test(msg)) return { ok: false, code: 401, error: `SportsCardsPro: ${msg}` };
        last = { ok: false, error: `SportsCardsPro: ${msg}` };
        continue;
      }
      return { ok: true, data: body };
    } catch (e) {
      last = { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "SportsCardsPro took too long to respond." : "Couldn't reach SportsCardsPro." };
    }
  }
  return last;
}

/** Up to 20 products matching a text search. */
export async function searchProducts(site: ProviderSite, q: string): Promise<ProviderResult<ProviderProduct[]>> {
  const r = await get(site, "/api/products", { q });
  if (!r.ok) return r;
  const list = Array.isArray(r.data.products) ? r.data.products : [];
  return { ok: true, data: list.map(parseApiProduct).filter((p): p is ProviderProduct => p !== null) };
}

/** One product with all its prices. */
export async function getProduct(site: ProviderSite, id: string): Promise<ProviderResult<ProviderProduct>> {
  const r = await get(site, "/api/product", { id });
  if (!r.ok) return r;
  const p = parseApiProduct(r.data);
  return p ? { ok: true, data: p } : { ok: false, error: "SportsCardsPro returned an unexpected product format." };
}

export function resetProviderThrottle() {
  lastCall = 0;
}

/** Download the price list CSV for up to 5 of your chosen sets (Settings → Popular sets). */
export async function downloadGuideCsv(host: GuideHost, uids: string[]): Promise<ProviderResult<string>> {
  const token = process.env.SPORTSCARDSPRO_TOKEN;
  if (!token) return { ok: false, error: "SportsCardsPro isn't connected (SPORTSCARDSPRO_TOKEN missing in Vercel)." };
  await waitTurn();
  try {
    countCall("guide");
    const res = await fetch(guideDownloadUrl(host, uids, token), { signal: AbortSignal.timeout(25_000), cache: "no-store" } as RequestInit);
    if (res.status === 429) return { ok: false, code: 429, error: "SportsCardsPro download limit reached — will retry next run." };
    if (res.status === 401 || res.status === 403) return { ok: false, code: res.status, error: "SportsCardsPro rejected the token for downloads." };
    if (!res.ok) return { ok: false, code: res.status, error: `SportsCardsPro download returned HTTP ${res.status}.` };
    return { ok: true, data: await res.text() };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "The price list download took too long." : "Couldn't reach SportsCardsPro." };
  }
}
