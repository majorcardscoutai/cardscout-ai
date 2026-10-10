import { saveSettingsAction } from "@/app/actions";
import { logout } from "@/app/login/actions";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { loadSettings } from "@/data/source";
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
  const { settings: s, source, error: dbError } = await loadSettings();

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
            <Field label="Exchange rate (1 USD = ? AUD)" hint="Manual for now — check today's rate">
              <input name="usdToAud" defaultValue={s.usdToAud} inputMode="decimal" required className={inputCls} />
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
