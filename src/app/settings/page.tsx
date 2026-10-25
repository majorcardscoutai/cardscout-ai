import { saveSettingsAction } from "@/app/actions";
import { logout } from "@/app/login/actions";
import { currentViewer } from "@/data/session";
import { databaseRulesOn } from "@/data/owner";
import { alertRecipient } from "@/lib/email";
import { addGuideSetAction, deleteMyAccountAction, refreshGuideAction, removeGuideSetAction, testProviderAction } from "@/app/actions";
import { MAX_GUIDE_SETS } from "@/lib/guide-csv";
import ProviderCredit from "@/components/ProviderCredit";
import { providerConfigured } from "@/lib/provider-client";
import { psaConfigured } from "@/lib/psa";
import { removeDeviceAction, testPushAction } from "@/app/push-actions";
import PushSetup from "@/components/PushSetup";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { listGuideSets, listPushSubscriptions } from "@/data/db";
import { loadSettings } from "@/data/source";
import { vapidPublicKey } from "@/lib/webpush";
import { OTHER_COUNTRIES, REGION_LABELS, taxHint, taxLabel } from "@/lib/region";
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
  const [{ settings: s, source, error: dbError, savedUsdToAud, fx }, devices, guideSets, viewer] = await Promise.all([
    loadSettings(),
    listPushSubscriptions(),
    listGuideSets(),
    currentViewer(),
  ]);
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
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-medium">Where you buy from</legend>
            <p className="mb-3 text-xs text-faint">
              Sets where eBay quotes shipping to, what the tax line means, and whether amounts also show in A$.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["AU", "US", "OTHER"] as const).map((r) => (
                <label key={r} className="flex items-start gap-3 rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                  <input type="radio" name="buyerRegion" value={r} defaultChecked={s.buyerRegion === r} className="mt-1 accent-gain" />
                  <span>
                    <span className="block text-sm">{REGION_LABELS[r]}</span>
                    <span className="block text-xs text-faint">
                      {r === "AU" ? "A$ (US$ underneath) · import GST" : r === "US" ? "US$ · sales tax" : "US$ · import tax / VAT"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Your country" hint="Only for Rest of the world">
                <select name="shipToCountry" defaultValue={s.shipToCountry ?? ""} className={inputCls}>
                  <option value="">Choose…</option>
                  {OTHER_COUNTRIES.map(([c, n]) => (
                    <option key={c} value={c}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="US ZIP code (optional)" hint="Only for United States — makes eBay's shipping quotes more accurate">
                <input name="shipToPostcode" defaultValue={s.shipToPostcode ?? ""} inputMode="numeric" maxLength={5} className={inputCls} />
              </Field>
            </div>
          </fieldset>
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
            <Field label={`${taxLabel(s.buyerRegion)} (%)`} hint={taxHint(s.buyerRegion)}>
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
                  <span className="block text-xs text-faint">The seller&apos;s shipping cost to you ({REGION_LABELS[s.buyerRegion]}), per card.</span>
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

      <Panel
        title="Market values"
        className="mt-6"
        right={<Tag tone={providerConfigured() ? "default" : "warn"}>{providerConfigured() ? "SportsCardsPro connected" : "Not connected"}</Tag>}
      >
        <p className="mb-3 text-sm text-muted">
          Automatic values from SportsCardsPro (sports) and PriceCharting (Pokémon) — one subscription covers both. Each card is
          looked up once and refreshed daily; your own Card Values always take priority.
        </p>
        {providerConfigured() ? (
          <form action={testProviderAction}>
            <SubmitButton tone="neutral">Test connection</SubmitButton>
          </form>
        ) : (
          <p className="text-xs text-warn">Add SPORTSCARDSPRO_TOKEN in Vercel → Settings → Environment Variables, then redeploy.</p>
        )}
        <ProviderCredit className="mt-3" />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span>
            PSA slab checks <span className="text-xs text-muted">· verifies the cert number on Analyse</span>
          </span>
          <Tag tone={psaConfigured() ? "default" : "warn"}>{psaConfigured() ? "Connected" : "Add PSA_API_TOKEN"}</Tag>
        </div>
      </Panel>

      {viewer?.admin && (
      <Panel
        title="Popular sets — daily price download"
        className="mt-6"
        right={<Tag>{guideSets.data.length} / {MAX_GUIDE_SETS} sets</Tag>}
      >
        <p className="mb-3 text-sm text-muted">
          Cards from these sets are valued instantly from a daily SportsCardsPro/PriceCharting download, instead of one lookup per second.
          Add the sets most flipped cards come from — the Profit Hunter page lists the best ones to add.
        </p>
        {guideSets.error && /guide_sets/.test(guideSets.error) ? (
          <p className="mb-3 text-xs text-warn">Run the Popular sets SQL in Supabase first (bottom of supabase/schema.sql).</p>
        ) : null}
        <form action={addGuideSetAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field
            label="Sets' “Download Price List” links — one per line"
            className="flex-1"
            hint="On each set's page (SportsCardsPro for sports, PriceCharting for Pokémon): right-click “Download Price List” → Copy Link Address, paste, new line, next. Only the set codes are kept — never your token."
          >
            <textarea
              name="link"
              required
              rows={4}
              placeholder={"https://www.pricecharting.com/price-guide/download-custom?t=…&console-uids=G…\nhttps://www.pricecharting.com/price-guide/download-custom?t=…&console-uids=G…"}
              className={inputCls}
            />
          </Field>
          <SubmitButton>Add sets</SubmitButton>
        </form>
        {guideSets.data.length > 0 && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {guideSets.data.map((g) => (
              <li key={g.uid} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{g.name ?? g.uid}</span>
                  <span className="block text-xs text-muted">
                    {g.rows !== null ? `${g.rows.toLocaleString("en-US")} cards · ` : ""}
                    {g.downloadedAt ? `updated ${new Date(g.downloadedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "not downloaded yet"}
                    {g.error ? <span className="text-loss"> · {g.error}</span> : null}
                  </span>
                </span>
                <form action={removeGuideSetAction}>
                  <input type="hidden" name="uid" value={g.uid} />
                  <button className="text-xs text-muted hover:text-loss">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {guideSets.data.length > 0 && (
          <form action={refreshGuideAction} className="mt-3">
            <SubmitButton tone="neutral">Refresh now</SubmitButton>
          </form>
        )}
        <p className="mt-3 text-[11px] text-faint">
          SportsCardsPro&apos;s downloads are meant for particular sets, so CardHawk downloads only the sets you add, up to 5 per request, once a day.
        </p>
      </Panel>
      )}

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

      <Panel title="Account" className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {viewer?.kind === "account" ? (
            <p className="text-sm text-muted">
              Signed in as <span className="text-ink">{viewer.email}</span>
              {viewer.admin && <span className="ml-2 rounded-md bg-gain-soft px-1.5 py-0.5 text-[11px] font-medium text-gain">Admin</span>}
              <span className="block text-xs text-faint">
                Stays signed in on this device for 30 days. Forgot your password? Sign out, then use &ldquo;Forgot password?&rdquo;.
              </span>
              <span className="mt-1 block text-xs text-faint">
                Deal alert emails go to {alertRecipient(viewer.email, viewer.admin) ?? viewer.email}
                {viewer.admin && process.env.ALERT_EMAIL ? " (ALERT_EMAIL, as you're an admin)" : ""}.
              </span>
              <span className="mt-1 block text-xs text-faint">
                {databaseRulesOn() ? (
                  <>Database protection: <span className="text-gain">on</span> — the database itself only lets this account reach its own data.</>
                ) : (
                  <>Database protection: <span className="text-warn">app only</span> — add SUPABASE_PUBLISHABLE_KEY in Vercel to switch on the database&apos;s own per-account rules.</>
                )}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">Not signed in.</p>
          )}
          <form action={logout}>
            <SubmitButton tone="neutral">Log out</SubmitButton>
          </form>
        </div>
        <p className="mt-4 text-xs text-faint">
          <a href="/terms" className="hover:text-accent hover:underline">Terms of Use</a> ·{" "}
          <a href="/privacy" className="hover:text-accent hover:underline">Privacy Policy</a>
        </p>
        {viewer && !viewer.admin && (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-xs text-faint">Delete my account</summary>
            <form action={deleteMyAccountAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Type DELETE to permanently remove your account and everything in it" className="flex-1">
                <input name="confirm" required autoComplete="off" className={inputCls} />
              </Field>
              <button className="rounded-lg border border-loss/50 px-4 py-2 text-sm font-semibold text-loss hover:bg-loss/10">Delete account</button>
            </form>
            <p className="mt-2 text-[11px] text-faint">
              Removes your settings, searches, finds, watchlist, portfolio, Card Values and phone alerts. This can&apos;t be undone.
            </p>
          </details>
        )}
      </Panel>
    </>
  );
}
