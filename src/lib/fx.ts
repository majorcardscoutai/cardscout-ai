/**
 * Live USD → AUD exchange rate from Frankfurter (free, no key; European Central Bank
 * reference rates, published once each working day). Server-only.
 *
 * Never throws: if the service is down or returns anything odd, it returns null and
 * the app falls back to the rate saved in Settings.
 */
export interface LiveFx {
  rate: number;
  date: string | null; // the ECB publication date the rate is for
}

const TTL_MS = 6 * 3_600_000;
let cache: { at: number; value: LiveFx } | null = null;

/** Accepts only a sane USD→AUD rate (guards against a broken response wrecking every number). */
export function parseFxResponse(body: unknown): LiveFx | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const rates = b.rates as Record<string, unknown> | undefined;
  const raw = typeof b.rate === "number" ? b.rate : typeof rates?.AUD === "number" ? rates.AUD : null;
  if (raw === null || !Number.isFinite(raw) || raw < 0.8 || raw > 3) return null;
  return { rate: Math.round(raw * 10000) / 10000, date: typeof b.date === "string" ? b.date.slice(0, 10) : null };
}

async function tryUrl(url: string): Promise<LiveFx | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 21600 } } as RequestInit);
    if (!res.ok) return null;
    return parseFxResponse(await res.json());
  } catch {
    return null;
  }
}

export async function liveUsdToAud(now = Date.now()): Promise<LiveFx | null> {
  if (process.env.FX_LIVE === "off") return null;
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const value =
    (await tryUrl("https://api.frankfurter.dev/v2/rate/USD/AUD")) ??
    (await tryUrl("https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD"));
  if (value) cache = { at: now, value };
  return value;
}

export function resetFxCache() {
  cache = null;
}
