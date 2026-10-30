/**
 * Each account's plan, stored on its profiles row (written only by the server, from Stripe's webhook).
 * Reading it never fails a page: a missing column (SQL not run yet) just means "no subscription".
 */
import { cache } from "react";
import { db, dbConfigured } from "@/lib/supabase";
import { accessFor, limitsFor, NO_BILLING, parsePlan, type Access, type BillingInfo, type Limits } from "@/lib/plans";
import type { SubscriptionUpdate } from "@/lib/stripe";
import { currentViewer } from "./session";

export function billingRequired(): boolean {
  return process.env.BILLING_REQUIRED === "1";
}

const COLS = "user_id, plan, plan_status, plan_period_end, cancel_at_period_end, founder, stripe_customer_id";

function rowToBilling(r: Record<string, unknown> | null | undefined): BillingInfo {
  if (!r) return NO_BILLING;
  return {
    plan: parsePlan(r.plan),
    status: typeof r.plan_status === "string" ? r.plan_status : null,
    periodEnd: typeof r.plan_period_end === "string" ? r.plan_period_end : null,
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    founder: r.founder === true,
    stripeCustomerId: typeof r.stripe_customer_id === "string" ? r.stripe_customer_id : null,
  };
}

export async function billingFor(userId: string): Promise<BillingInfo> {
  if (!dbConfigured()) return NO_BILLING;
  try {
    const { data, error } = await db().from("profiles").select(COLS).eq("user_id", userId).maybeSingle();
    if (error) return NO_BILLING;
    return rowToBilling(data as Record<string, unknown> | null);
  } catch {
    return NO_BILLING;
  }
}

/** Plans for many accounts at once (scheduled scans). */
export async function billingMap(userIds: string[]): Promise<Map<string, BillingInfo>> {
  const out = new Map<string, BillingInfo>();
  if (!dbConfigured() || userIds.length === 0) return out;
  try {
    const { data, error } = await db().from("profiles").select(COLS).in("user_id", userIds);
    if (error) return out;
    for (const r of (data ?? []) as Record<string, unknown>[]) out.set(String(r.user_id), rowToBilling(r));
  } catch {
    // no columns yet → everyone treated as having no subscription
  }
  return out;
}

export interface ViewerPlan {
  access: Access;
  limits: Limits;
  billing: BillingInfo;
}

/** The signed-in person's access (cached per request). */
export const viewerPlan = cache(async (): Promise<ViewerPlan | null> => {
  const v = await currentViewer().catch(() => null);
  if (!v) return null;
  const billing = await billingFor(v.id);
  const access = accessFor({ admin: v.admin, billingRequired: billingRequired(), billing });
  return { access, limits: limitsFor(access), billing };
});

/** Founding-member spots taken so far. */
export async function foundersTaken(): Promise<number> {
  if (!dbConfigured()) return 0;
  try {
    const { count, error } = await db().from("profiles").select("user_id", { count: "exact", head: true }).eq("founder", true);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function saveCustomerId(userId: string, customerId: string): Promise<void> {
  try {
    await db().from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
  } catch {
    // non-fatal: the subscription webhook carries it too
  }
}

/** Store a subscription change. Finds the account by user id (metadata) or, failing that, by Stripe customer. */
export async function saveSubscription(u: SubscriptionUpdate): Promise<string | null> {
  if (!dbConfigured()) return "Database not configured";
  try {
    const fields: Record<string, unknown> = {
      plan: u.plan,
      plan_status: u.status,
      plan_period_end: u.periodEnd,
      cancel_at_period_end: u.cancelAtPeriodEnd,
      stripe_subscription_id: u.subscriptionId,
    };
    if (u.customerId) fields.stripe_customer_id = u.customerId;
    if (u.founder) fields.founder = true; // once a founder, always a founder (the coupon is "forever")
    let q = db().from("profiles").update(fields);
    if (u.userId) q = q.eq("user_id", u.userId);
    else if (u.customerId) q = q.eq("stripe_customer_id", u.customerId);
    else return "No account on this subscription";
    const { error } = await q;
    if (error) throw error;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  }
}

/** Which of these accounts are admins (ADMIN_EMAILS) — admins are never limited. */
export async function adminIds(userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!dbConfigured() || userIds.length === 0) return out;
  try {
    const { isAdminEmail } = await import("@/lib/supabase-auth");
    const { data } = await db().from("profiles").select("user_id, email").in("user_id", userIds);
    for (const r of (data ?? []) as { user_id: string; email: string }[]) if (isAdminEmail(r.email)) out.add(r.user_id);
  } catch {
    // ignore
  }
  return out;
}

/** Limits for whoever is acting now (pages are already behind sign-in; unknown = same rule as everyone without a plan). */
export async function currentLimits(): Promise<Limits> {
  const p = await viewerPlan();
  return p?.limits ?? limitsFor(billingRequired() ? "none" : "beta");
}
