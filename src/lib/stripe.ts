/**
 * Stripe, via its REST API (no extra packages). Server only.
 *
 *   STRIPE_SECRET_KEY        sk_test_… (test mode) or sk_live_…
 *   STRIPE_WEBHOOK_SECRET    whsec_… from the webhook endpoint in Stripe
 *   STRIPE_PRICE_HOBBY / STRIPE_PRICE_COLLECTOR / STRIPE_PRICE_PRO   price_… (monthly, AUD, GST inclusive)
 *   STRIPE_FOUNDER_COUPON    coupon id: 30% off, duration "forever"
 *   FOUNDER_UNTIL            optional end date of the founding offer (default 31 Dec 2026)
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { parsePlan, type PlanId } from "./plans";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && PRICE_ENV.every((k) => !!process.env[k]);
}

const PRICE_ENV = ["STRIPE_PRICE_HOBBY", "STRIPE_PRICE_COLLECTOR", "STRIPE_PRICE_PRO"] as const;

export function priceIdFor(plan: PlanId): string | null {
  return process.env[{ hobby: "STRIPE_PRICE_HOBBY", collector: "STRIPE_PRICE_COLLECTOR", pro: "STRIPE_PRICE_PRO" }[plan]] ?? null;
}

export function planForPriceId(priceId: string | null | undefined, env: Record<string, string | undefined> = process.env): PlanId | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_HOBBY) return "hobby";
  if (priceId === env.STRIPE_PRICE_COLLECTOR) return "collector";
  if (priceId === env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

/** Stripe's form encoding: { a: { b: [ { c: 1 } ] } } → "a[b][0][c]=1". */
export function toForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => parts.push(typeof item === "object" ? toForm(item as Record<string, unknown>, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else if (typeof v === "object") parts.push(toForm(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

export async function stripePost<T = Record<string, unknown>>(path: string, params: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: "Stripe isn't set up (STRIPE_SECRET_KEY missing)." };
  try {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm(params),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (json.error as { message?: string } | undefined)?.message ?? `Stripe said ${res.status}`;
      return { ok: false, error: err };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Check a webhook really came from Stripe: header "t=<unix>,v1=<hex HMAC-SHA256 of `${t}.${body}`>".
 * Rejects anything older than 5 minutes (replays).
 */
export function verifyStripeSignature(body: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || sigs.length === 0 || Math.abs(nowSec - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export interface SubscriptionUpdate {
  userId: string | null;
  customerId: string | null;
  subscriptionId: string;
  plan: PlanId | null;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  founder: boolean;
}

/** A Stripe subscription object → what we store on the profile. */
export function subscriptionUpdate(sub: Record<string, unknown>, deleted = false, env: Record<string, string | undefined> = process.env): SubscriptionUpdate | null {
  if (typeof sub.id !== "string") return null;
  const meta = (sub.metadata ?? {}) as Record<string, string>;
  const items = ((sub.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? []) as Record<string, unknown>[];
  const first = items[0] ?? {};
  const priceId = (first.price as { id?: string } | undefined)?.id ?? null;
  // Newer Stripe API versions put the period end on the item.
  const end = (sub.current_period_end ?? first.current_period_end) as number | undefined;
  return {
    userId: typeof meta.user_id === "string" && meta.user_id ? meta.user_id : null,
    customerId: typeof sub.customer === "string" ? sub.customer : null,
    subscriptionId: sub.id,
    plan: planForPriceId(priceId, env) ?? parsePlan(meta.plan),
    status: deleted ? "canceled" : String(sub.status ?? "incomplete"),
    periodEnd: typeof end === "number" ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    founder: meta.founder === "1",
  };
}
