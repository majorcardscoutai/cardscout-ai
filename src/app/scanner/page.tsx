import { DemoBanner, PageHeader, Panel, StatusRow, Tag } from "@/components/ui";
import { getSavedSearches, getSettings } from "@/data/source";
import { formatMoney } from "@/lib/currency";

const PIPELINE = [
  ["Search", "Scheduled job queries eBay's Browse API with each saved search (authorised access only)."],
  ["De-duplicate", "Listings already seen are skipped using their eBay item ID."],
  ["Identify", "Title and item specifics are parsed into an exact card identity (set, number, parallel, grade)."],
  ["Value", "Exact-match sold comparisons from an authorised source are run through the valuation engine."],
  ["Score", "Profit, ROI and the 100-point score are calculated with your settings."],
  ["Alert", "Listings that meet your criteria are saved and you're notified."],
];

export const dynamic = "force-dynamic";

export default async function AutomaticScannerPage() {
  const fx = (await getSettings()).usdToAud;
  const searches = getSavedSearches();

  return (
    <>
      <PageHeader
        title="Automatic Scanner"
        subtitle="Scheduled searches for new listings that clear your rules."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-loss/40 bg-loss-soft px-3 py-1 text-xs font-medium text-loss">
            <span className="h-2 w-2 rounded-full bg-loss" /> Not running
          </span>
        }
      />
      <DemoBanner>
        The automatic scanner is not built yet. It will only be marked as running once a background job and an
        authorised data source have been connected and tested (Phase 4). The saved searches below are examples.
      </DemoBanner>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Saved searches" className="lg:col-span-2" right={<Tag tone="warn">Demo</Tag>}>
          <ul className="divide-y divide-line">
            {searches.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-faint">Keywords: “{s.keywords}”</div>
                </div>
                <div className="flex gap-2 text-xs text-muted">
                  <span className="num">≤ {formatMoney(s.maxPriceUsd, "USD")} ({formatMoney(s.maxPriceUsd * fx, "AUD")})</span>
                  <span>· min score {s.minScore}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Scanner status">
          <div className="divide-y divide-line">
            <StatusRow label="eBay Browse API" status="off" detail="Needs eBay developer keys" />
            <StatusRow label="Sold-price source" status="off" detail="Chosen in Phase 3" />
            <StatusRow label="Scheduled job" status="off" detail="Vercel Cron · Phase 4" />
            <StatusRow label="Alerts" status="off" detail="Email or push · Phase 4" />
          </div>
        </Panel>
      </div>

      <Panel title="How the scanner will work" className="mt-6">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map(([title, body], i) => (
            <li key={title} className="rounded-lg bg-panel-2 p-3 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className="num grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs text-accent">{i + 1}</span>
                <span className="text-sm font-medium">{title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
