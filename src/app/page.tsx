import { OffCentreWarning } from "@/components/OffCentreWarning";
import Link from "next/link";
import CardThumb from "@/components/CardThumb";
import { formatMoney, moneyPair, moneyText } from "@/lib/currency";
import { Money, PageHeader, Panel, Pct, StatCard, StatusRow, Tag } from "@/components/ui";
import { cardValueMap, lastScanRuns } from "@/data/db";
import { currentDeals, sortDeals } from "@/data/deals";
import { ebayConfigured } from "@/lib/ebay/client";
import { providerConfigured } from "@/lib/provider-client";
import { listHoldings, listWatchlist, loadSettings } from "@/data/source";
import { displayFx, REGION_LABELS } from "@/lib/region";
import { EbayLink } from "@/components/EbayLink";
import SetupGuide, { setupGuideData } from "@/components/SetupGuide";
import { psaConfigured } from "@/lib/psa";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams?: Promise<{ welcome?: string }> }) {
  const welcome = (await searchParams)?.welcome === "1";
  const setup = await setupGuideData(welcome);
  const [{ source, error: settingsError, fx: liveFx }, watch, hold, live, runs, values] = await Promise.all([
    loadSettings(),
    listWatchlist(),
    listHoldings(),
    currentDeals(),
    lastScanRuns(1),
    cardValueMap(),
  ]);
  const settings = live.settings;
  const top = sortDeals(live.deals, "profit").slice(0, 4);
  const lastRun = runs.data[0] ?? null;
  const fx = displayFx(settings); // A$ shown for Australian buyers only
  const holdings = hold.data;
  const portfolioCost = holdings.reduce((s, h) => s + h.purchasePriceUsd + h.purchaseCostsUsd, 0);
  const dbOk = source === "database" && !watch.error && !hold.error;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live listings are flagged when the price clears your ROI and profit rules against your Card Values."
      />
      <SetupGuide data={setup} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Watchlist" value={watch.data.length} sub="cards you're tracking" />
        <StatCard
          label="Portfolio cost basis"
          value={moneyPair(portfolioCost, fx).main}
          sub={`${holdings.length} cards held${fx > 0 ? ` · ${moneyPair(portfolioCost, fx).sub}` : ""}`}
        />
        <StatCard
          label="Live deals right now"
          value={live.deals.length}
          sub={lastRun ? `Last scan ${new Date(lastRun.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}` : "No scans yet"}
          tone={live.deals.length > 0 ? "gain" : "neutral"}
        />
        {settings.buyerRegion === "AU" ? (
          <StatCard label="Exchange rate" value={settings.usdToAud} sub={liveFx ? `1 USD in AUD · live${liveFx.date ? ` (${liveFx.date})` : ""}` : "1 USD in AUD · backup rate from Settings"} />
        ) : (
          <StatCard label="Buying from" value={REGION_LABELS[settings.buyerRegion]} sub="Amounts in US$ · change in Settings" />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Best live deals"
          className="lg:col-span-2"
          right={<Link href="/deals" className="text-xs text-accent hover:underline">All deals →</Link>}
        >
          {top.length === 0 ? (
            <p className="text-sm text-muted">
              No live listings meet your rules right now.{" "}
              {values.map.size === 0 ? "Add Card Values for cards you'd buy so scans can price them." : "Scans run every 3 hours."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {top.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0">
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.imageUrl} alt="" className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-line" />
                  ) : (
                    <div className="h-12 w-9 shrink-0 rounded bg-panel-2 ring-1 ring-line" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="line-clamp-1 text-sm font-medium hover:text-accent">
                      {d.title}
                    </a>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {d.isAuction ? <Tag tone="warn">Auction</Tag> : <Tag>Buy It Now</Tag>}
                      <Pct value={d.roiPercent} />
                      <span className="text-faint">ROI</span>
                      <EbayLink url={d.url} />
                      <OffCentreWarning title={d.title} />
                    </div>
                  </div>
                  <div className="text-right">
                    <Money usd={d.priceUsd} fx={fx} size="sm" align="right" />
                    <div className="mt-0.5"><Money usd={d.netProfitUsd} fx={fx} size="sm" tone="auto" align="right" /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
              status={values.map.size > 0 || providerConfigured() ? "ok" : "off"}
              detail={
                providerConfigured()
                  ? `${[...values.map.values()].filter((v) => (v.source ?? "you") !== "you").length} from SportsCardsPro/PriceCharting · ${[...values.map.values()].filter((v) => (v.source ?? "you") === "you").length} set by you`
                  : `${values.map.size} saved by you · connect SportsCardsPro for automatic values`
              }
            />
            <StatusRow
              label="Population data"
              status={psaConfigured() ? "waiting" : "off"}
              detail={
                psaConfigured()
                  ? "From PSA's slab check on Analyse, once PSA approves API access · never estimated"
                  : "Add PSA_API_TOKEN · shown as missing, never estimated"
              }
            />
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
