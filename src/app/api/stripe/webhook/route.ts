import { NextResponse } from "next/server";
import { saveCustomerId, saveSubscription } from "@/data/billing";
import { subscriptionUpdate, verifyStripeSignature } from "@/lib/stripe";

/**
 * Stripe → CardHawk: keeps each account's plan in sync (new subscription, trial ending, plan change,
 * failed payment, cancellation). Every request must carry a valid Stripe signature (STRIPE_WEBHOOK_SECRET).
 * Events to send (Stripe → Developers → Webhooks): checkout.session.completed,
 * customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const body = await req.text();
  if (!verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed": {
      const uid = typeof obj.client_reference_id === "string" ? obj.client_reference_id : null;
      if (uid && typeof obj.customer === "string") await saveCustomerId(uid, obj.customer);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const u = subscriptionUpdate(obj, event.type === "customer.subscription.deleted");
      if (u) {
        const err = await saveSubscription(u);
        // 500 makes Stripe retry later (e.g. the profiles columns aren't there yet).
        if (err) return NextResponse.json({ error: err }, { status: 500 });
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
