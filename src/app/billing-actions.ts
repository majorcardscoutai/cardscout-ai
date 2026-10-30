"use server";
/**
 * Plan & billing: start a Stripe Checkout for a plan, or open Stripe's billing portal (change plan, card, cancel).
 * Payment details are entered on Stripe's own pages — CardHawk never sees card numbers.
 */
import { redirect } from "next/navigation";
import { billingFor, billingRequired, foundersTaken } from "@/data/billing";
import { currentViewer } from "@/data/session";
import { FOUNDER, founderOfferOpen, parsePlan } from "@/lib/plans";
import { priceIdFor, stripeConfigured, stripePost } from "@/lib/stripe";

const appUrl = () => (process.env.APP_URL ?? "https://www.cardhawkai.com").replace(/\/+$/, "");

function back(key: "saved" | "error", value: string): never {
  redirect(`/billing?${key}=${encodeURIComponent(value)}`);
}

export async function startCheckoutAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login?next=/billing");
  if (!viewer.admin && !billingRequired()) redirect("/");
  const plan = parsePlan(formData.get("plan"));
  if (!plan) back("error", "Pick a plan.");
  if (!stripeConfigured()) back("error", "Payments aren't switched on yet.");
  const price = priceIdFor(plan);
  const billing = await billingFor(viewer.id);
  if (billing.plan && billing.status && ["trialing", "active", "past_due"].includes(billing.status))
    back("error", "You already have a plan — use “Manage billing” to change it.");

  const coupon = process.env.STRIPE_FOUNDER_COUPON;
  const founder = !!coupon && !billing.stripeCustomerId && founderOfferOpen(await foundersTaken(), Date.now(), process.env.FOUNDER_UNTIL || undefined);

  const r = await stripePost<{ url?: string }>("checkout/sessions", {
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: viewer.id,
    ...(billing.stripeCustomerId ? { customer: billing.stripeCustomerId } : { customer_email: viewer.email }),
    success_url: `${appUrl()}/billing?saved=${encodeURIComponent("Welcome aboard — your plan is being set up (a few seconds).")}`,
    cancel_url: `${appUrl()}/billing`,
    metadata: { user_id: viewer.id, plan },
    subscription_data: {
      metadata: { user_id: viewer.id, plan, founder: founder ? "1" : "0" },
      ...(founder ? { trial_period_days: FOUNDER.trialDays } : {}),
    },
    ...(founder ? { discounts: [{ coupon }] } : { allow_promotion_codes: "true" }),
    billing_address_collection: "auto",
  });
  if (!r.ok) back("error", `Couldn't start checkout: ${r.error}`);
  if (!r.data.url) back("error", "Stripe didn't return a checkout page.");
  redirect(r.data.url);
}

export async function billingPortalAction() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login?next=/billing");
  const billing = await billingFor(viewer.id);
  if (!billing.stripeCustomerId) back("error", "No billing account yet — choose a plan first.");
  const r = await stripePost<{ url?: string }>("billing_portal/sessions", { customer: billing.stripeCustomerId, return_url: `${appUrl()}/billing` });
  if (!r.ok) back("error", `Couldn't open billing: ${r.error}`);
  if (!r.data.url) back("error", "Stripe didn't return a billing page.");
  redirect(r.data.url);
}
