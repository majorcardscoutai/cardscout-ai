import { billingPortalAction, startCheckoutAction } from "@/app/billing-actions";
import { notFound } from "next/navigation";
import { Flash } from "@/components/FormBits";
import { PageHeader, Panel } from "@/components/ui";
import { billingRequired, foundersTaken, viewerPlan } from "@/data/billing";
import { accessLabel, aud, FOUNDER, founderOfferOpen, founderPrice, PLAN_ORDER, PLANS } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";

export const metadata = { title: "CardHawk AI · Plan & billing" };
export const dynamic = "force-dynamic";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : null);

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const [me, taken] = await Promise.all([viewerPlan(), foundersTaken()]);
  if (!me) return null;
  // Hidden from members until billing is switched on (admins can preview it).
  if (me.access !== "admin" && !billingRequired()) notFound();
  const ready = stripeConfigured();
  const founderOpen = !!process.env.STRIPE_FOUNDER_COUPON && !me.billing.stripeCustomerId && founderOfferOpen(taken, Date.now(), process.env.FOUNDER_UNTIL || undefined);
  const subscribed = !!me.billing.plan && ["trialing", "active", "past_due"].includes(me.billing.status ?? "");

  return (
    <>
      <PageHeader title="Plan & billing" subtitle="Prices in AUD per month, including GST. Cancel any time from Manage billing." />
      <Flash saved={saved} error={error} />

      <Panel title="Your plan">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold" data-testid="current-plan">{accessLabel(me.access)}</div>
            <div className="mt-1 text-sm text-muted">
              {me.access === "admin" && "Admins have every feature."}
              {me.access === "beta" && "You're in the free beta — every feature is on. Paid plans start when billing is switched on; you'll get notice first."}
              {me.access === "none" && "Choose a plan below to keep automatic scanning and alerts running."}
              {subscribed && me.billing.status === "trialing" && `Free trial — first payment on ${date(me.billing.periodEnd)}.`}
              {subscribed && me.billing.status === "active" && (me.billing.cancelAtPeriodEnd ? `Cancelled — access until ${date(me.billing.periodEnd)}.` : `Renews ${date(me.billing.periodEnd)}.`)}
              {subscribed && me.billing.status === "past_due" && "Your last payment didn't go through — update your card in Manage billing."}
            </div>
            {me.billing.founder && <div className="mt-2 inline-block rounded-md bg-gain-soft px-2 py-0.5 text-xs font-medium text-gain">Founding member · {FOUNDER.percentOff}% off for life</div>}
          </div>
          {me.billing.stripeCustomerId && (
            <form action={billingPortalAction}>
              <button className="rounded-lg border border-line-strong px-4 py-2 text-sm hover:bg-panel-2">Manage billing</button>
            </form>
          )}
        </div>
      </Panel>

      {founderOpen && !subscribed && (
        <div className="mt-6 rounded-xl border border-gain/40 bg-gain-soft px-4 py-3 text-sm text-gain" data-testid="founder-offer">
          <strong>Founding member offer:</strong> {FOUNDER.percentOff}% off for life + {FOUNDER.trialDays} days free.{" "}
          {FOUNDER.slots - taken} of {FOUNDER.slots} spots left.
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const current = subscribed && me.billing.plan === id;
          return (
            <div key={id} className={`flex flex-col rounded-2xl border bg-panel p-5 ${id === "collector" ? "border-accent/50" : "border-line"}`} data-testid={`plan-${id}`}>
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{p.name}</div>
                {id === "collector" && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">Most popular</span>}
              </div>
              <div className="mt-1 text-xs text-muted">{p.tagline}</div>
              <div className="mt-4 flex items-baseline gap-2">
                {founderOpen && !subscribed ? (
                  <>
                    <span className="num text-3xl font-semibold">{aud(founderPrice(id))}</span>
                    <span className="num text-sm text-faint line-through">{aud(p.priceAud)}</span>
                  </>
                ) : (
                  <span className="num text-3xl font-semibold">{aud(p.priceAud)}</span>
                )}
                <span className="text-xs text-faint">/month</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-gain">✓</span><span>{f}</span></li>
                ))}
              </ul>
              {current ? (
                <div className="mt-5 rounded-lg border border-gain/40 py-2 text-center text-sm text-gain">Your plan</div>
              ) : subscribed ? (
                <form action={billingPortalAction} className="mt-5">
                  <button className="w-full rounded-lg border border-line-strong py-2 text-sm hover:bg-panel-2">Switch in Manage billing</button>
                </form>
              ) : (
                <form action={startCheckoutAction} className="mt-5">
                  <input type="hidden" name="plan" value={id} />
                  <button disabled={!ready} className={`w-full rounded-lg py-2 text-sm font-semibold disabled:opacity-50 ${id === "collector" ? "bg-gain text-bg" : "border border-gain text-gain hover:bg-gain/10"}`}>
                    {ready ? (founderOpen ? `Start ${FOUNDER.trialDays}-day free trial` : `Choose ${p.name}`) : "Coming soon"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-faint">
        Search limits count searches that are running — keep as many paused searches as you like and switch between them any time.
        Payments are handled by Stripe — CardHawk never sees your card number. Your plan renews monthly until you cancel; cancelling keeps
        access until the end of the period you&apos;ve paid for. {billingRequired() ? "" : "Billing isn't switched on yet."} CardHawk shows market
        estimates, not financial advice — see the Terms of Use.
      </p>
    </>
  );
}
