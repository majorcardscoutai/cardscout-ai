import Link from "next/link";
import { Field, inputCls, SubmitButton } from "@/components/FormBits";
import { IconAlert } from "@/components/Icons";
import { DemoBanner, Money, PageHeader, Panel, StatusRow, Tag } from "@/components/ui";
import { getSavedSearches, getSettings } from "@/data/source";
import { formatMoney } from "@/lib/currency";
import { ebayConfigured, searchListings, toUsd, type SearchInput } from "@/lib/ebay/client";

export const dynamic = "force-dynamic";

const PIPELINE = [
  ["Search", "Scheduled job queries eBay's Browse API with each saved search (authorised access only)."],
  ["De-duplicate", "Listings already seen are skipped using their eBay item ID."],
  ["Identify", "Title and item specifics are parsed into an exact card identity (set, number, parallel, grade)."],
  ["Value", "Exact-match sold comparisons from an authorised source are run through the valuation engine."],
  ["Score", "Profit, ROI and the 100-point score are calculated with your settings."],
  ["Alert", "Listings that meet your criteria are saved and you're notified."],
];

type Params = { q?: string; market?: string; category?: string; max?: string; format?: string };

function parseSearch(p: Params): SearchInput | null {
  if (!p.q) return null;
  const max = Number(p.max);
  return {
    q: p.q.slice(0, 120),
    market: p.market === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
    category: p.category === "pokemon" ? "pokemon" : "sportsCards",
    maxPrice: p.max && Number.isFinite(max) && max > 0 ? max : null,
    format: p.format === "FIXED_PRICE" || p.format === "AUCTION" ? p.format : "ALL",
  };
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default async function AutomaticScannerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const fx = (await getSettings()).usdToAud;
  const searches = getSavedSearches();
  const connected = ebayConfigured();
  const search = parseSearch(params);
  const result = search && connected ? await searchListings(search) : null;

  return (
    <>
      <PageHeader
        title="Automatic Scanner"
        subtitle="Search live eBay listings now. Scheduled scanning and alerts come in Phase 4."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-loss/40 bg-loss-soft px-3 py-1 text-xs font-medium text-loss">
            <span className="h-2 w-2 rounded-full bg-loss" /> Scheduled scanning not running
          </span>
        }
      />

      <Panel title="Search eBay now" className="mb-6" right={<Tag tone={connected ? "default" : "warn"}>{connected ? "eBay connected" : "eBay not connected yet"}</Tag>}>
        <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end">
          <Field label="Search" className="col-span-2 sm:col-span-2">
            <input name="q" defaultValue={params.q ?? ""} placeholder="ohtani topps update psa 10" required minLength={3} className={inputCls} />
          </Field>
          <Field label="eBay site">
            <select name="market" defaultValue={search?.market ?? "EBAY_US"} className={inputCls}>
              <option value="EBAY_US">eBay US (US$)</option>
              <option value="EBAY_AU">eBay AU (A$)</option>
            </select>
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={search?.category ?? "sportsCards"} className={inputCls}>
              <option value="sportsCards">Sports cards</option>
              <option value="pokemon">Pokémon</option>
            </select>
          </Field>
          <Field label="Max price" hint="In that site's currency">
            <input name="max" inputMode="decimal" defaultValue={params.max ?? ""} className={inputCls} />
          </Field>
          <Field label="Type">
            <select name="format" defaultValue={search?.format ?? "ALL"} className={inputCls}>
              <option value="ALL">All</option>
              <option value="FIXED_PRICE">Buy It Now</option>
              <option value="AUCTION">Auction</option>
            </select>
          </Field>
          <div className="col-span-2 flex justify-end sm:col-span-6">
            <SubmitButton tone="neutral">Search newest listings</SubmitButton>
          </div>
        </form>

        {!connected && (
          <p className="mt-3 text-xs text-faint">Live search switches on once your eBay developer keys are added.</p>
        )}

        {result && !result.ok && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        {result && result.ok && (
          <div className="mt-5">
            <p className="mb-3 text-xs text-warn">
              Live asking prices only — these are <strong>not</strong> valued or scored, because verified sold data isn&apos;t
              connected yet. Open a listing in the Manual Scanner to check the profit with your own resale estimate.
            </p>
            {result.data.items.length === 0 ? (
              <p className="text-sm text-muted">No listings found. Try fewer words or a higher max price.</p>
            ) : (
              <ul className="divide-y divide-line">
                {result.data.items.map((l) => {
                  const usd = toUsd(l.price, fx);
                  return (
                    <li key={l.itemId} className="flex items-center gap-3 py-3">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imageUrl} alt="" className="h-16 w-12 shrink-0 rounded object-cover ring-1 ring-line" />
                      ) : (
                        <div className="h-16 w-12 shrink-0 rounded bg-panel-2 ring-1 ring-line" />
                      )}
                      <div className="min-w-0 flex-1">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm hover:text-accent">
                          {l.title}
                        </a>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-faint">
                          <Tag>{l.isAuction ? `Auction${l.bidCount !== null ? ` · ${l.bidCount} bids` : ""}` : l.acceptsOffers ? "Buy It Now · Offers" : "Buy It Now"}</Tag>
                          {l.country && <Tag>{l.country}</Tag>}
                          {l.listedAt && <span>Listed {ago(l.listedAt)}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        {usd !== null ? <Money usd={usd} fx={fx} size="sm" align="right" /> : <span className="text-xs text-faint">{l.price ? `${l.price.currency} ${l.price.value}` : "—"}</span>}
                        <Link
                          href={`/analyse?item=${l.itemId}&market=${search?.market}`}
                          className="mt-1 block text-xs text-accent hover:underline"
                        >
                          Analyse →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">
              Showing {result.data.items.length} of {result.data.total.toLocaleString("en-AU")} · newest first · source: eBay Browse API
            </p>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Saved searches (examples)" className="lg:col-span-2" right={<Tag tone="warn">Demo · Phase 4</Tag>}>
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
            <StatusRow label="eBay Browse API" status={connected ? "ok" : "off"} detail={connected ? "Live listings available" : "Needs eBay developer keys"} />
            <StatusRow label="Sold-price source" status="off" detail="PriceCharting — to decide" />
            <StatusRow label="Scheduled job" status="off" detail="Vercel Cron · Phase 4" />
            <StatusRow label="Alerts" status="off" detail="Email · Phase 4" />
          </div>
        </Panel>
      </div>

      <Panel title="How automatic scanning will work" className="mt-6">
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
      <div className="mt-6">
        <DemoBanner>The saved searches above are examples. Live search results are real eBay listings.</DemoBanner>
      </div>
    </>
  );
}
