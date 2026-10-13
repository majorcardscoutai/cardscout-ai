import Link from "next/link";
import CardThumb from "@/components/CardThumb";
import { formatMoney } from "@/lib/currency";
import {
  ConfidenceBadge,
  DemoBanner,
  Money,
  PageHeader,
  Panel,
  Pct,
  ScoreBadge,
  StatCard,
  StatusRow,
} from "@/components/ui";
import { cardValueMap, lastScanRuns, listRecentHits } from "@/data/db";
import { ebayConfigured } from "@/lib/ebay/client";
import { revalueHit } from "@/lib/scan";
import { getAssessments, listHoldings, listWatchlist, loadSettings } from "@/data/source";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [{ settings, source, error: settingsError }, watch, hold, hits, runs, values] = await Promise.all([
    loadSettings(),
    listWatchlist(),
    listHoldings(),
    listRecentHits(400),
    lastScanRuns(1),
    cardValueMap(),
  ]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  // Re-priced with today's Card Values, so values added after a scan count.
  const dealsThisWeek = hits.data
    .filter((h) => new Date(h.createdAt).getTime() > weekAgo)
    .map((h) => revalueHit(h, settings, values.map))
    .filter((h) => h.meetsCriteria).length;
  const lastRun = runs.data[0] ?? null;
  const fx = settings.usdToAud;
  const assessments = getAssessments(settings);
  const holdings = hold.data;
  const portfolioCost = holdings.reduce((s, h) => s + h.purchasePriceUsd + h.purchaseCostsUsd, 0);
  const dbOk = source === "database" && !watch.error && !hold.error;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Listings are only flagged when verified sold data supports the price and the numbers clear your ROI and profit rules."
      />
      <DemoBanner>
        &ldquo;Best opportunities&rdquo; below are demonstration listings until automatic sold prices are connected. Scan
        results, Card Values, watchlist, portfolio and settings are real.
      </DemoBanner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Watchlist" value={watch.data.length} sub="cards you're tracking" />
        <StatCard
          label="Portfolio cost basis"
          value={formatMoney(portfolioCost, "USD")}
          sub={`${holdings.length} cards held · ${formatMoney(portfolioCost * fx, "AUD")}`}
        />
        <StatCard
          label="Deals found by scans (7 days)"
          value={dealsThisWeek}
          sub={lastRun ? `Last scan ${new Date(lastRun.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}` : "No scans yet"}
          tone={dealsThisWeek > 0 ? "gain" : "neutral"}
        />
        <StatCard label="Exchange rate" value={fx} sub="1 USD in AUD · set in Settings" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Best opportunities (demo)"
          className="lg:col-span-2"
          right={<Link href="/deals" className="text-xs text-accent hover:underline">All deals →</Link>}
        >
          <ul className="divide-y divide-line">
            {assessments.slice(0, 4).map((a) => (
              <li key={a.listing.id}>
                <Link href={`/deals/${a.listing.id}`} className="flex items-center gap-3 py-3 first:pt-0">
                  <CardThumb card={a.listing.card} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.listing.title}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <ConfidenceBadge confidence={a.valuation.confidence} />
                      <Pct value={a.profit?.roiPercent} />
                      <span className="text-xs text-faint">ROI</span>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <Money usd={a.profit?.netProfitUsd} fx={fx} tone="auto" align="right" />
                  </div>
                  <ScoreBadge score={a.score.total} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="System status">
          <div className="divide-y divide-line">
            <StatusRow
              label="Database"
              status={dbOk ? "ok" : "off"}
              detail={dbOk ? "Supabase · settings, watchlist, portfolio" : (settingsError ?? watch.error ?? hold.error ?? "Not connected")}
            />
            <StatusRow
              label="Listing data"
              status={ebayConfigured() ? "ok" : "off"}
              detail={ebayConfigured() ? "eBay Browse API · live" : "Needs eBay keys"}
            />
            <StatusRow
              label="Card values"
              status={values.map.size > 0 ? "ok" : "off"}
              detail={`${values.map.size} saved by you · automatic sold prices not connected yet`}
            />
            <StatusRow label="Population data" status="off" detail="Shown as missing — never estimated" />
            <StatusRow
              label="Automatic scanning"
              status={lastRun && Date.now() - new Date(lastRun.createdAt).getTime() < 4 * 3_600_000 ? "ok" : "off"}
              detail={lastRun ? `Last scan ${Math.round((Date.now() - new Date(lastRun.createdAt).getTime()) / 60000)} min ago` : "No scan has run yet"}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Your watchlist"
        className="mt-6"
        right={<Link href="/watchlist" className="text-xs text-accent hover:underline">Open →</Link>}
      >
        {watch.data.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing saved yet.{" "}
            <Link href="/analyse" className="text-accent hover:underline">Analyse a card</Link> to add one.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {watch.data.slice(0, 6).map((w) => (
              <Link key={w.id} href="/watchlist" className="flex items-center gap-3 rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <CardThumb card={w.card} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm">{w.title}</div>
                  <div className="mt-1"><Money usd={w.askingPriceUsd} fx={fx} size="sm" /></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
