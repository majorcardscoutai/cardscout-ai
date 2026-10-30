import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { accessFor, founderOfferOpen, founderPrice, limitsFor, NO_BILLING, PLANS } from "../src/lib/plans";
import { planForPriceId, subscriptionUpdate, toForm, verifyStripeSignature } from "../src/lib/stripe";

test("prices and founder discount (30% off for life)", () => {
  assert.deepEqual([PLANS.hobby.priceAud, PLANS.collector.priceAud, PLANS.pro.priceAud], [14.99, 29.99, 89]);
  assert.equal(founderPrice("hobby"), 10.49);
  assert.equal(founderPrice("collector"), 20.99);
  assert.equal(founderPrice("pro"), 62.3);
  const now = Date.parse("2026-11-15T00:00:00Z");
  assert.equal(founderOfferOpen(49, now), true);
  assert.equal(founderOfferOpen(50, now), false);
  assert.equal(founderOfferOpen(0, Date.parse("2027-01-02T00:00:00Z")), false);
});

test("access: admin > live subscription > free beta (billing off) > none", () => {
  const sub = (plan: "hobby" | "pro", status: string) => ({ ...NO_BILLING, plan, status });
  assert.equal(accessFor({ admin: true, billingRequired: true, billing: NO_BILLING }), "admin");
  assert.equal(accessFor({ admin: false, billingRequired: true, billing: sub("pro", "trialing") }), "pro");
  assert.equal(accessFor({ admin: false, billingRequired: true, billing: sub("hobby", "past_due") }), "hobby");
  assert.equal(accessFor({ admin: false, billingRequired: true, billing: sub("pro", "canceled") }), "none");
  assert.equal(accessFor({ admin: false, billingRequired: false, billing: NO_BILLING }), "beta");
  assert.equal(accessFor({ admin: false, billingRequired: true, billing: NO_BILLING }), "none");
});

test("limits per plan: searches 3/6/10, Hunter Pro only, phone alerts Collector+", () => {
  assert.deepEqual(limitsFor("hobby"), { savedSearches: 3, hunter: false, push: false, scans: true });
  assert.deepEqual(limitsFor("collector"), { savedSearches: 6, hunter: false, push: true, scans: true });
  assert.deepEqual(limitsFor("pro"), { savedSearches: 10, hunter: true, push: true, scans: true });
  assert.deepEqual(limitsFor("beta"), { savedSearches: 5, hunter: true, push: true, scans: true });
  assert.deepEqual(limitsFor("none"), { savedSearches: 0, hunter: false, push: false, scans: false });
  assert.equal(limitsFor("admin").savedSearches, Infinity);
});

test("Stripe form encoding", () => {
  assert.equal(
    toForm({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], subscription_data: { metadata: { user_id: "u1" } }, skip: undefined }),
    "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&subscription_data%5Bmetadata%5D%5Buser_id%5D=u1",
  );
});

test("webhook signature: valid, tampered, stale", () => {
  const secret = "whsec_test";
  const body = '{"type":"customer.subscription.updated"}';
  const t = 1_800_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 10), true);
  assert.equal(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, t + 10), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_other", t + 10), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 1000), false);
  assert.equal(verifyStripeSignature(body, null, secret, t), false);
});

test("subscription → stored plan", () => {
  const env = { STRIPE_PRICE_HOBBY: "price_h", STRIPE_PRICE_COLLECTOR: "price_c", STRIPE_PRICE_PRO: "price_p" };
  assert.equal(planForPriceId("price_c", env), "collector");
  const u = subscriptionUpdate(
    { id: "sub_1", customer: "cus_1", status: "trialing", cancel_at_period_end: false, metadata: { user_id: "u1", plan: "pro", founder: "1" },
      items: { data: [{ price: { id: "price_p" }, current_period_end: 1_793_000_000 }] } },
    false, env,
  );
  assert.deepEqual(u, { userId: "u1", customerId: "cus_1", subscriptionId: "sub_1", plan: "pro", status: "trialing", periodEnd: new Date(1_793_000_000_000).toISOString(), cancelAtPeriodEnd: false, founder: true });
  assert.equal(subscriptionUpdate({ id: "sub_1", status: "active", items: { data: [] } }, true, env)?.status, "canceled");
});
