/**
 * Paid plans (decided 30 Oct 2026). Prices in AUD per month, INCLUDING GST. Pure — tested in tests/plans.test.ts.
 *
 * Billing is switched on with BILLING_REQUIRED=1 in Vercel. Until then every signed-in account has full
 * "beta" access (nothing changes for invited testers). Admins always have full access.
 */
export type PlanId = "hobby" | "collector" | "pro";
export type Access = PlanId | "beta" | "admin" | "none";

export interface Plan {
  id: PlanId;
  name: string;
  priceAud: number;
  savedSearches: number;
  hunter: boolean;
  push: boolean;
  tagline: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  hobby: {
    id: "hobby",
    name: "Hobby",
    priceAud: 14.99,
    savedSearches: 3,
    hunter: false,
    push: false,
    tagline: "For collectors hunting a few cards",
    features: ["3 saved searches, scanned automatically", "Live search with market values", "Real profit after fees, GST and shipping", "Analyse any eBay listing", "Email deal alerts", "Watchlist and portfolio"],
  },
  collector: {
    id: "collector",
    name: "Collector",
    priceAud: 29.99,
    savedSearches: 6,
    hunter: false,
    push: true,
    tagline: "For regular buyers and part-time flippers",
    features: ["Everything in Hobby", "6 saved searches", "Phone notifications", "PSA / BGS-only filters", "Your own Card Values"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceAud: 89,
    savedSearches: 10,
    hunter: true,
    push: true,
    tagline: "For flippers who want every deal first",
    features: ["Everything in Collector", "10 saved searches", "Profit Hunter: scans the whole market every 10 minutes", "Sales-per-year filter", "Early access to new features"],
  },
};

export const PLAN_ORDER: PlanId[] = ["hobby", "collector", "pro"];

/** Founding members: the first 50 paying members get 30% off for life + 7 days free. */
export const FOUNDER = { slots: 50, percentOff: 30, trialDays: 7, defaultUntil: "2026-12-31T13:00:00Z" } as const;

export interface BillingInfo {
  plan: PlanId | null;
  /** Stripe subscription status: trialing, active, past_due, canceled, unpaid, incomplete… */
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  founder: boolean;
  stripeCustomerId: string | null;
}

export const NO_BILLING: BillingInfo = { plan: null, status: null, periodEnd: null, cancelAtPeriodEnd: false, founder: false, stripeCustomerId: null };

/** Statuses that keep access ("past_due" = Stripe is retrying a failed card — keep access during its retries). */
const LIVE = new Set(["trialing", "active", "past_due"]);

export function accessFor(o: { admin: boolean; billingRequired: boolean; billing: BillingInfo }): Access {
  if (o.admin) return "admin";
  if (o.billing.plan && o.billing.status && LIVE.has(o.billing.status)) return o.billing.plan;
  if (!o.billingRequired) return "beta";
  return "none";
}

export interface Limits {
  savedSearches: number;
  hunter: boolean;
  push: boolean;
  /** Scheduled scans run for this account at all. */
  scans: boolean;
}

/** Beta testers keep the beta allowance (5 searches, everything on) until billing is switched on. */
export const BETA_SAVED_SEARCHES = 5;

export function limitsFor(a: Access): Limits {
  if (a === "admin") return { savedSearches: Infinity, hunter: true, push: true, scans: true };
  if (a === "beta") return { savedSearches: BETA_SAVED_SEARCHES, hunter: true, push: true, scans: true };
  if (a === "none") return { savedSearches: 0, hunter: false, push: false, scans: false };
  const p = PLANS[a];
  return { savedSearches: p.savedSearches, hunter: p.hunter, push: p.push, scans: true };
}

export function accessLabel(a: Access): string {
  return a === "admin" ? "Admin" : a === "beta" ? "Beta (free)" : a === "none" ? "No plan" : PLANS[a].name;
}

export function founderOfferOpen(taken: number, now = Date.now(), until: string = FOUNDER.defaultUntil): boolean {
  return taken < FOUNDER.slots && now < Date.parse(until);
}

export function founderPrice(plan: PlanId): number {
  return Math.round(PLANS[plan].priceAud * (1 - FOUNDER.percentOff / 100) * 100) / 100;
}

export function parsePlan(v: unknown): PlanId | null {
  return v === "hobby" || v === "collector" || v === "pro" ? v : null;
}

/** "A$14.99" */
export const aud = (n: number) => `A$${n.toFixed(2).replace(/\.00$/, "")}`;
