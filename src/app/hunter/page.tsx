import Link from "next/link";
import { huntNowAction, saveHunterAction } from "@/app/actions";
import { DealRow, ago } from "@/components/DealRow";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import ProviderCredit from "@/components/ProviderCredit";
import HuntButton from "@/components/HuntButton";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { hunterView, sortDeals, type DealSort, type HunterCoverage } from "@/data/deals";
import { ebayConfigured } from "@/lib/ebay/client";
import { HUNTER_PAGE_SIZE, HUNTER_SPORT_LABEL, HUNTER_SPORTS, parseHunterSport } from "@/lib/hunter";
import { providerConfigured } from "@/lib/provider-client";
import { displayFx } from "@/lib/region";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SORTS: { key: DealSort; label: string }[] = [
  { key: "profit", label: "Profit" },
  { key: "roi", label: "ROI" },
  { key: "newest", label: "Newest" },
  { key: "price", label: "Price" },
];

type Params = { saved?: string; error?: string; sort?: string };

export default async function ProfitHunterPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const sort: DealSort = SORTS.some((s) => s.key === params.sort) ? (params.sort as DealSort) : "profit";
  const v = await hunterView();
  const { config } = v;
  const fx = displayFx(v.settings);
  const cur = config.market === "EBAY_AU" ? "A$" : "US$";
  const needsSql = v.configError !== null && /hunter_config|relation|does not exist/i.test(v.configError);
  const lastRun = v.searches
    .map((s) => s.lastRunAt)
    .filter((x): x is string => x !== null)
    .sort()
    .reverse()[0] ?? null;
  const rows = sortDeals(v.deals, sort);
  const ready = ebayConfigured() && providerConfigured();

  return (
    <>
      <PageHeader
        title="Profit Hunter"
        subtitle="Checks every new graded listing under your budget — not just cards you search for — values each one from the price guide, and flags anything that clears your ROI and profit rules."
        action={
          config.enabled ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-gain/40 bg-gain-soft px-3 py-1 text-xs font-medium text-gain">
              <span className="h-2 w-2 rounded-full bg-gain" /> Hunting{lastRun ? ` · last run ${ago(lastRun)}` : " · not run yet"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
              <span className="h-2 w-2 rounded-full bg-faint" /> Off
            </span>
          )
        }
      />
      <Flash saved={params.saved} error={params.error} />
      <DbError error={v.error} />
      {needsSql && (
        <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          The Profit Hunter needs a one-time database update. Run the Profit Hunter SQL in Supabase (bottom of supabase/schema.sql), then
          refresh this page.
        </div>
      )}
      {!ready && (
        <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          The Profit Hunter needs eBay and SportsCardsPro connected ({!ebayConfigured() ? "eBay keys missing" : "SPORTSCARDSPRO_TOKEN missing"}).
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Profitable now" value={String(rows.length)} tone="gain" />
        <Stat label="Live listings checked" value={String(v.checked)} />
        <Stat label="With a market value" value={String(v.valued)} />
        <Stat label="Budget" value={`${cur}${config.minPrice > 0 ? `${config.minPrice}–` : "0–"}${config.budget}`} />
      </div>
      <p className="-mt-3 mb-6 text-xs text-muted">
        Flagging cards with at least <span className="text-ink">{v.rules.minRoiPercent}% ROI</span> and{" "}
        <span className="text-ink">US${v.rules.minProfitUsd} profit</span>
        {config.minRoi === null && config.minProfit === null ? " (your Settings rules)" : ""}
        {config.minSales > 0 ? `, selling at least ${config.minSales} times a year` : ""}.
      </p>

      <Panel
        title={`Profitable finds (${rows.length})`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-faint">Sort:</span>
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={s.key === "profit" ? "/hunter" : `/hunter?sort=${s.key}`}
                  className={`rounded-md px-2 py-0.5 ${s.key === sort ? "bg-ink text-bg" : "text-accent hover:underline"}`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <form action={huntNowAction}>
              <HuntButton />
            </form>
          </div>
        }
      >
        <ProviderCredit className="mb-3" />
        <p className="mb-4 text-xs text-warn">
          Found automatically from listing titles and matched to the price guide — always open the listing and check it&apos;s the same card
          (player, set, number, parallel, grade) before you buy. Use &ldquo;Wrong match?&rdquo; if it isn&apos;t.
        </p>
        {rows.length === 0 ? (
          <div className="text-sm text-muted">
            <p>{config.enabled ? "Nothing profitable right now." : "The Profit Hunter is off — set it up below."}</p>
            {config.enabled && (
              <p className="mt-2 text-xs text-faint">
                {v.checked === 0
                  ? "No listings checked yet. Click Hunt now, or wait for the hourly run."
                  : `Checked ${v.checked} live listing${v.checked === 1 ? "" : "s"}; ${v.valued} have a market value so far. New cards are valued about one per second, so coverage grows with every run.`}
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((d, i) => (
              <DealRow key={d.id} d={d} fx={fx} rank={i + 1} returnTo="/hunter" />
            ))}
          </ul>
        )}
        {v.slowSellers.length > 0 && (
          <p className="mt-4 text-xs text-faint">
            {v.slowSellers.length} more profitable listing{v.slowSellers.length === 1 ? " is" : "s are"} hidden because the card sells fewer than{" "}
            {config.minSales} times a year (hard to resell). Lower &ldquo;Minimum sales per year&rdquo; below to see {v.slowSellers.length === 1 ? "it" : "them"}.
          </p>
        )}
      </Panel>

      {v.nearMisses.length > 0 && (
        <Panel title="Close to your rules" className="mt-6" right={<Tag>within 15% of your max price</Tag>}>
          <p className="mb-3 text-xs text-faint">Priced just above what your rules allow — worth a Best Offer.</p>
          <ul className="divide-y divide-line">
            {v.nearMisses.slice(0, 10).map((d) => (
              <DealRow key={d.id} d={d} fx={fx} returnTo="/hunter" />
            ))}
          </ul>
        </Panel>
      )}

      {v.coverage.total > 0 && <CoveragePanel c={v.coverage} />}

      <Panel title="Hunter setup" className="mt-6" right={v.saved ? <Tag>Saved</Tag> : <Tag tone="warn">Not set up yet</Tag>}>
        <form action={saveHunterAction} className="space-y-5">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="h-4 w-4 accent-gain" />
            <span>
              <span className="font-medium">Turn on the Profit Hunter</span>
              <span className="block text-xs text-muted">Runs every hour, plus whenever you click Hunt now. Alerts use your email and phone notifications.</span>
            </span>
          </label>

          <fieldset>
            <legend className="mb-2 text-xs text-muted">Hunt in</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {HUNTER_SPORTS.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="checkbox" name={`s_${s}`} defaultChecked={config.sports.includes(s)} className="h-4 w-4 accent-gain" />
                  {HUNTER_SPORT_LABEL[s]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-faint">Graded cards only (PSA, BGS, SGC, CGC) — raw cards are too risky to match automatically.</p>
          </fieldset>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="eBay site">
              <select name="market" defaultValue={config.market} className={inputCls}>
                <option value="EBAY_US">eBay US (US$)</option>
                <option value="EBAY_AU">eBay AU (A$)</option>
              </select>
            </Field>
            <Field label={`Budget — max per card (${cur})`}>
              <input name="budget" inputMode="decimal" defaultValue={String(config.budget)} className={inputCls} />
            </Field>
            <Field label={`Min price (${cur})`} hint="Skips cheap cards that rarely profit after fees">
              <input name="minPrice" inputMode="decimal" defaultValue={String(config.minPrice)} className={inputCls} />
            </Field>
            <Field label="Minimum ROI (%)" hint={`Blank = Settings (${v.settings.minRoiPercent}%)`}>
              <input name="minRoi" inputMode="decimal" defaultValue={config.minRoi === null ? "" : String(config.minRoi)} placeholder={String(v.settings.minRoiPercent)} className={inputCls} />
            </Field>
            <Field label="Minimum profit (US$)" hint={`Blank = Settings (US$${v.settings.minProfitUsd})`}>
              <input name="minProfit" inputMode="decimal" defaultValue={config.minProfit === null ? "" : String(config.minProfit)} placeholder={String(v.settings.minProfitUsd)} className={inputCls} />
            </Field>
            <Field label="Minimum sales per year" hint="0 = no limit">
              <input name="minSales" inputMode="numeric" defaultValue={String(config.minSales)} className={inputCls} />
            </Field>
            <Field label="Exclude words" className="col-span-2 sm:col-span-3" hint="Hide titles containing any of these">
              <input name="x" defaultValue={config.excludeWords} maxLength={300} className={inputCls} />
            </Field>
            <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm sm:col-span-1">
              <input type="checkbox" name="auctions" defaultChecked={config.includeAuctions} className="h-4 w-4 accent-gain" />
              Include auctions
            </label>
          </div>
          <p className="text-xs text-faint">
            Profit is after fees, shipping, tax and other costs from <Link href="/settings" className="underline">Settings</Link>. Auctions only count in
            their last 24 hours.
          </p>
          <div className="flex justify-end">
            <SubmitButton>Save hunter</SubmitButton>
          </div>
        </form>
      </Panel>

      <Panel title="How it works" className="mt-6">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            Every hour it takes the newest {HUNTER_PAGE_SIZE} graded listings per sport under your budget, reads each card from the title, and
            values it from SportsCardsPro (sports) or PriceCharting (Pokémon). Your own Card Values always win.
          </li>
          <li>
            New cards are valued about one per second (the price guide&apos;s limit), so the first runs cover part of what it sees; values are
            saved and refreshed daily, so coverage grows quickly.
          </li>
          <li>Only exact matches count (same player, year, set, number, parallel and grade). Anything unclear is skipped, not guessed.</li>
          <li>Cards that sell fewer times a year than your minimum are left out, so you don&apos;t buy something you can&apos;t resell.</li>
        </ul>
        {v.searches.length > 0 && (
          <div className="mt-4 space-y-1 text-xs text-faint">
            {v.searches.map((s) => {
              const sport = parseHunterSport(s.query);
              return (
                <div key={s.id}>
                  {sport ? HUNTER_SPORT_LABEL[sport] : s.name}: {s.active ? (s.lastRunAt ? `last run ${ago(s.lastRunAt)} · ${s.lastRunStatus ?? ""}` : "not run yet") : "off"}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className={`num mt-1 text-xl ${tone === "gain" ? "text-gain" : ""}`}>{value}</div>
    </div>
  );
}

const MISSING_LABEL: Record<string, string> = {
  "card number": "no card number (#)",
  set: "set not recognised",
  year: "no year",
  player: "player/character not recognised",
  grade: "no grade",
  "grading company": "no grading company",
  category: "sport/game unclear",
};

function CoveragePanel({ c }: { c: HunterCoverage }) {
  type Row = { label: string; n: number; tone: "gain" | "muted" | "warn"; note: string };
  const all: Row[] = [
    { label: "Valued", n: c.valued, tone: "gain", note: "Has a market value — profit checked." },
    { label: "Waiting for a lookup", n: c.waiting, tone: "muted", note: "Readable; will be looked up in the next runs (about one card per second)." },
    { label: "Title missing details", n: c.unreadable, tone: "warn", note: "The title doesn't say enough to find the exact card, so it's skipped rather than guessed." },
    { label: "No exact match in the guide", n: c.noMatch, tone: "warn", note: "Read fine, but the price guide names it differently or doesn't list it." },
    { label: "Several possible matches", n: c.ambiguous, tone: "warn", note: "More than one guide card fits — skipped to avoid a wrong value." },
    { label: "No price for that grade", n: c.noPrice + c.noGradePrice, tone: "muted", note: "The guide has the card but no price for this grade (e.g. PSA 6.5, Authentic)." },
    { label: "You marked wrong", n: c.rejected, tone: "muted", note: "Your “Wrong match?” choice." },
  ];
  const rows = all.filter((r) => r.n > 0);
  const pct = (n: number) => Math.round((n / c.total) * 100);
  return (
    <Panel title="Why listings have no value" className="mt-6" right={<Tag>{c.total} live listings</Tag>}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{r.label}</span>
              <span className="num text-muted">
                {r.n} · {pct(r.n)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div
                className={`h-full rounded-full ${r.tone === "gain" ? "bg-gain" : r.tone === "warn" ? "bg-warn" : "bg-faint"}`}
                style={{ width: `${Math.max(pct(r.n), 1)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-faint">{r.note}</p>
          </li>
        ))}
      </ul>
      {c.missing.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Most common gaps in titles:{" "}
          {c.missing
            .slice(0, 4)
            .map(([m, n]) => `${MISSING_LABEL[m] ?? m} (${n})`)
            .join(" · ")}
          .
        </p>
      )}
      {c.examples.unreadable.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-accent">Examples: titles missing details</summary>
          <ul className="mt-2 space-y-1.5 text-muted">
            {c.examples.unreadable.map((e) => (
              <li key={e.url}>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">{e.title}</a>
                <span className="text-faint"> — missing {e.missing.map((m) => MISSING_LABEL[m] ?? m).join(", ") || "details"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {c.examples.noMatch.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-accent">Examples: no exact match in the guide</summary>
          <ul className="mt-2 space-y-1.5 text-muted">
            {c.examples.noMatch.map((e) => (
              <li key={e.url}>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">{e.title}</a>
                {e.detail && <span className="block text-faint">{e.detail}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
