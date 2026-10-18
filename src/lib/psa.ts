/**
 * PSA Public API — official slab (certificate) lookup. Server-only (uses PSA_API_TOKEN).
 * Docs: https://www.psacard.com/publicapi/documentation · use is governed by PSA's API End User Agreement.
 *
 * Subscription-friendly: a certificate's details don't change, so results are cached in the database
 * (table psa_certs, shared by every user) and PSA is only asked when someone opens Analyse.
 * Never throws: returns { ok: false, error } so the page always works.
 */
import type { PsaCert } from "./sales";

const API = "https://api.psacard.com/publicapi/cert/GetByCertNumber/";

export function psaConfigured(): boolean {
  return Boolean(process.env.PSA_API_TOKEN);
}

export type PsaResult = { ok: true; data: PsaCert } | { ok: false; error: string; code?: number };

/** Turn PSA's response into our shape (null if it isn't a PSA card cert). */
export function parsePsaCert(raw: unknown): PsaCert | null {
  const c = (raw as { PSACert?: Record<string, unknown> } | null)?.PSACert;
  if (!c || (typeof c.CertNumber !== "string" && typeof c.CertNumber !== "number")) return null;
  const s = (k: string) => (typeof c[k] === "string" && (c[k] as string).trim() !== "" ? (c[k] as string).trim() : null);
  const n = (k: string) => (typeof c[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : null);
  return {
    certNumber: String(c.CertNumber),
    year: s("Year"),
    brand: s("Brand"),
    subject: s("Subject"),
    cardNumber: s("CardNumber"),
    variety: s("Variety"),
    grade: s("CardGrade") ?? s("GradeDescription"),
    population: n("TotalPopulation"),
    populationHigher: n("PopulationHigher"),
  };
}

export async function fetchPsaCert(cert: string): Promise<PsaResult> {
  const token = process.env.PSA_API_TOKEN;
  if (!token) return { ok: false, error: "PSA slab checks aren't set up (PSA_API_TOKEN missing)." };
  if (!/^\d{6,12}$/.test(cert)) return { ok: false, error: "That doesn't look like a PSA cert number." };
  try {
    const res = await fetch(API + cert, {
      headers: { Authorization: `bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    } as RequestInit);
    if (res.status === 401 || res.status === 403) return { ok: false, code: res.status, error: "PSA rejected the token — check PSA_API_TOKEN in Vercel." };
    if (res.status === 429) return { ok: false, code: 429, error: "PSA's daily lookup limit is reached — try again tomorrow." };
    if (!res.ok) return { ok: false, code: res.status, error: `PSA returned HTTP ${res.status}.` };
    const parsed = parsePsaCert(await res.json().catch(() => null));
    return parsed ? { ok: true, data: parsed } : { ok: false, code: 404, error: "PSA has no card record for that cert number." };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "PSA took too long to respond." : "Couldn't reach PSA." };
  }
}
