import { saveSettingsAction } from "@/app/actions";
import { logout } from "@/app/login/actions";
import { removeDeviceAction, testPushAction } from "@/app/push-actions";
import PushSetup from "@/components/PushSetup";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { listPushSubscriptions } from "@/data/db";
import { loadSettings } from "@/data/source";
import { vapidPublicKey } from "@/lib/webpush";
import { DEMAND_TIERS } from "@/lib/config";
import { CONFIDENCE_CAPS, SCORE_WEIGHTS } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const pct = (fraction: number) => String(Math.round(fraction * 100 * 10000) / 10000);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const [{ settings: s, source, error: dbError, savedUsdToAud, fx }, devices] = await Promise.all([loadSettings(), listPushSubscriptions()]);
  const pushKey = vapidPublicKey();

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profit assumptions. Every calculation in the app uses these." />
      <Flash saved={saved} error={error} />
      <DbError error={dbError} />

      <Panel
        title="Profit assumptions"
        right={<Tag tone={source === "database" ? "default" : "warn"}>{source === "database" ? "Saved in database" : "Defaults (not saved)"}</Tag>}
      >
        <form action={saveSettingsAction} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Backup exchange rate (1 USD = ? AUD)"
              hint={
                fx
                  ? `Live rate in use: ${fx.rate}${fx.date ? ` (ECB, ${fx.date})` : ""}. This one is only used if the live rate is unavailable.`
                  : "Live rate unavailable right now — this rate is being used."
              }
            >
              <input name="usdToAud" defaultValue={savedUsdToAud ?? s.usdToAud} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Marketplace fee (%)" hint="Check your eBay seller account">
              <input name="feePercent" defaultValue={pct(s.marketplaceFeeRate)} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Fixed fee per order (US$)">
              <input name="fixedFee" defaultValue={s.marketplaceFixedFeeUsd} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Shipping to buyer (US$)" hint="Your cost to post when reselling">
              <input name="outboundShipping" defaultValue={s.outboundShippingUsd} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Import GST (%)" hint="0 for domestic purchases">
              <input name="importTaxPercent" defaultValue={pct(s.importTaxRate)} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Other costs per card (US$)" hint="Sleeves, top-loaders, packaging">
              <input name="otherCosts" defaultValue={s.otherCostsUsd} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Minimum ROI (%)">
              <input name="minRoi" defaultValue={s.minRoiPercent} inputMode="decimal" required className={inputCls} />
            </Field>
            <Field label="Minimum net profit (US$)">
              <input name="minProfit" defaultValue={s.minProfitUsd} inputMode="decimal" required className={inputCls} />
            </Field>
          </div>
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-medium">Shipping to you</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <input
                  type="radio"
                  name="inboundShippingMode"
                  value="ebay"
                  defaultChecked={s.inboundShippingMode !== "fixed"}
                  className="mt-1 accent-gain"
                />
                <span>
                  <span className="block text-sm">Use eBay&apos;s quoted shipping</span>
                  <span className="block text-xs text-faint">The seller&apos;s shipping cost to Australia, per card.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <input
                  type="radio"
                  name="inboundShippingMode"
                  value="fixed"
                  defaultChecked={s.inboundShippingMode === "fixed"}
                  className="mt-1 accent-gain"
                />
                <span>
                  <span className="block text-sm">Parcel locker — fixed amount per card</span>
                  <span className="block text-xs text-faint">
                    Ignores eBay&apos;s shipping. Use 0, or your share of the monthly shipment.
                  </span>
                </span>
              </label>
            </div>
            <Field label="Parcel locker cost per card (US$)" hint="Only used when parcel locker is selected" className="mt-3 sm:w-64">
              <input name="inboundShippingFixed" defaultValue={s.inboundShippingFixedUsd} inputMode="decimal" className={inputCls} />
            </Field>
          </fieldset>
          <div className="flex justify-end">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </form>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Score weights (total 100)">
          <ul className="space-y-2 text-sm">
            {Object.entries(SCORE_WEIGHTS).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="num">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">
            Score caps by valuation confidence: high {CONFIDENCE_CAPS.high}, medium {CONFIDENCE_CAPS.medium}, low{" "}
            {CONFIDENCE_CAPS.low}. No verified value = no score.
          </p>
        </Panel>

        <Panel title="Collector demand tiers (manual)">
          <ul className="space-y-2 text-sm">
            {Object.entries(DEMAND_TIERS).map(([name, tier]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="text-muted">{tier}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">
            Edit in src/lib/config.ts. Anyone not listed counts as “medium”. This is your judgement, not market data.
          </p>
        </Panel>
      </div>

      <div id="alerts" className="scroll-mt-24">
        <Panel title="Phone notifications" className="mt-6" right={<Tag>{devices.data.length} device{devices.data.length === 1 ? "" : "s"}</Tag>}>
          <p className="mb-4 text-sm text-muted">
            Get a notification on your phone when a scan finds a new deal — alongside the email. Turn it on separately on each
            device you want alerts on.
          </p>
          <PushSetup publicKey={pushKey} />
          {devices.error && !/push_subscriptions/.test(devices.error) && <p className="mt-3 text-xs text-loss">{devices.error}</p>}
          {devices.error && /push_subscriptions/.test(devices.error) && (
            <p className="mt-3 text-xs text-warn">Run the Phase 5 SQL in Supabase to finish setting this up (see PROGRESS.md).</p>
          )}
          {devices.data.length > 0 && (
            <>
              <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
                {devices.data.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{d.label ?? "Device"}</div>
                      <div className="text-xs text-faint">
                        Added {new Date(d.createdAt).toLocaleDateString("en-AU")}
                        {d.lastOkAt ? ` · last delivered ${new Date(d.lastOkAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}` : ""}
                        {d.lastError ? ` · ⚠ ${d.lastError}` : ""}
                      </div>
                    </div>
                    <form action={removeDeviceAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-xs text-muted hover:text-loss">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={testPushAction} className="mt-3">
                <SubmitButton tone="neutral">Send test notification</SubmitButton>
              </form>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Security" className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Signed in on this device for 30 days. To log out everywhere, change APP_PASSWORD.
          </p>
          <form action={logout}>
            <SubmitButton tone="neutral">Log out</SubmitButton>
          </form>
        </div>
      </Panel>
    </>
  );
}
