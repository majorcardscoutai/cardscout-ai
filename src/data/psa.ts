/**
 * PSA slab check with a shared database cache, so each certificate is fetched from PSA once
 * for all users (PSA's API has a daily limit per account). Population counts refresh after 30 days.
 */
import { fetchPsaCert, psaConfigured, type PsaResult } from "@/lib/psa";
import { getCachedPsaCert, savePsaCert } from "./db";

const POPULATION_REFRESH_MS = 30 * 86_400_000;

export async function checkPsaCert(cert: string): Promise<PsaResult & { cached?: boolean }> {
  const cached = await getCachedPsaCert(cert);
  const fresh = cached.data && cached.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < POPULATION_REFRESH_MS;
  if (cached.data && (fresh || !psaConfigured())) return { ok: true, data: cached.data, cached: true };
  const r = await fetchPsaCert(cert);
  if (r.ok) {
    await savePsaCert(r.data); // ignore errors: the page works without the cache (e.g. SQL not run yet)
    return r;
  }
  // PSA unavailable (limit, outage) — an older cached record is still right about the card and grade.
  if (cached.data) return { ok: true, data: cached.data, cached: true };
  return r;
}
