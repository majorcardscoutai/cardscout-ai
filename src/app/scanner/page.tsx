import Link from "next/link";
import {
  addSavedSearchAction,
  deleteSavedSearchAction,
  scanNowAction,
  toggleSavedSearchAction,
  updateSavedSearchExcludeAction,
} from "@/app/actions";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { IconAlert } from "@/components/Icons";
import { Money, PageHeader, Panel, Pct, StatusRow, Tag } from "@/components/ui";
import { cardValueMap, lastScanRuns, listPushSubscriptions, listRecentHits, listSavedSearches } from "@/data/db";
import { pushConfigured } from "@/lib/webpush";
import { getSettings } from "@/data/source";
import { ebayConfigured, searchListings, type SearchInput } from "@/lib/ebay/client";
import { emailConfigured } from "@/lib/email";
import { excludedBy, excludeWordsText, parseExcludeWords } from "@/lib/exclude";
import { auctionEnded, auctionTooEarly, evaluateListing, revalueHit } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = {
  q?: string;
  market?: string;
  category?: string;
  max?: string;
  format?: string;
  x?: string;
  saved?: string;
  error?: string;
  deals?: string;
  auctions?: string;
};

function addValueHref(title: string, itemId: string): string {
  return `/values?from=${encodeURIComponent(title.slice(0, 200))}&item=${encodeURIComponent(itemId)}#add`;
}

function parseSearch(p: Params): SearchInput | null {
  if (!p.q) return null;
  const max = Number(p.max);
  return {
    q: p.q.slice(0, 120),
    market: p.market === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
    category: p.category === "pokemon" ? "pokemon" : "sportsCards",
    maxPrice: p.max && Number.isFinite(max) && max > 0 ? max : null,
    format: p.format === "FIXED_PRICE" || p.format === "AUCTION" || p.format === "BEST_OFFER" ? p.format : "ALL",
    exclude: parseExcludeWords(p.x),
  };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function endsIn(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "ended";
  if (mins < 60) return `ends in ${mins}m`;
  if (mins < 60 * 48) return `ends in ${Math.round(mins / 60)}h`;
  return `ends in ${Math.round(mins / 1440)}d`;
}

const FORMAT_LABEL = { ALL: "All", FIXED_PRICE: "Buy It Now", AUCTION: "Auction", BEST_OFFER: "Best Offer" } as const;

export default async function AutomaticScannerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const settings = await getSettings();
  const fx = settings.usdToAud;
  const connected = ebayConfigured();
  const search = parseSearch(params);
  const onlyDeals = params.deals === "1";

  const [result, values, saved, hits, runs, devices] = await Promise.all([
    search && connected ? searchListings(search) : Promise.resolve(null),
    cardValueMap(),
    listSavedSearches(),
    listRecentHits(400),
    lastScanRuns(5),
    listPushSubscriptions(),
  ]);

  // Results are re-priced with TODAY's values + settings, so a value added after a scan counts straight away.
  const now = Date.now();
  const excludeBySearch = new Map(saved.data.map((x) => [x.id, parseExcludeWords(x.excludeWords)]));
  const showAllAuctions = params.auctions === "all";
  const revalued = hits.data
    .map((h) => revalueHit(h, settings, values.map))
    .filter((h) => !auctionEnded(h, now)) // ended auctions are gone — never show them
    .filter((h) => !excludedBy(h.title, excludeBySearch.get(h.searchId) ?? [])); // exclude words apply to earlier results too
  const early = revalued.filter((h) => auctionTooEarly(h, now));
  const visible = showAllAuctions ? revalued : revalued.filter((h) => !auctionTooEarly(h, now));
  const shownHits = (onlyDeals ? visible.filter((h) => h.meetsCriteria) : visible).slice(0, 60);
  const dealCount = visible.filter((h) => h.meetsCriteria).length;
  const qs = (o: { deals?: boolean; auctions?: boolean }) => {
    const p = new URLSearchParams();
    if (o.deals) p.set("deals", "1");
    if (o.auctions) p.set("auctions", "all");
    const str = p.toString();
    return str ? `/scanner?${str}` : "/scanner";
  };

  const lastScheduled = runs.data.find((r) => r.trigger === "schedule" || r.trigger === "daily") ?? null;
  const scheduleHealthy = lastScheduled !== null && Date.now() - new Date(lastScheduled.createdAt).getTime() < 4 * 3_600_000;
  const searchNames = new Map(saved.data.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="Automatic Scanner"
        subtitle="Search eBay now, save searches, and let CardScout check them every few hours against your card values."
        action={
          scheduleHealthy ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-gain/40 bg-gain-soft px-3 py-1 text-xs font-medium text-gain">
              <span className="h-2 w-2 rounded-full bg-gain" /> Scheduled scanning running · last {ago(lastScheduled?.createdAt ?? null)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-loss/40 bg-loss-soft px-3 py-1 text-xs font-medium text-loss">
              <span className="h-2 w-2 rounded-full bg-loss" /> Scheduled scanning not confirmed
              {lastScheduled ? ` · last ${ago(lastScheduled.createdAt)}` : ""}
            </span>
          )
        }
      />
      <Flash saved={params.saved} error={params.error} />
      <DbError error={saved.error} />

      {/* ---------- Search now ---------- */}
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
            <select name="format" defaultValue={search?.format ?? "FIXED_PRICE"} className={inputCls}>
              <option value="FIXED_PRICE">Buy It Now</option>
              <option value="BEST_OFFER">Best Offer (accepts offers)</option>
              <option value="AUCTION">Auction</option>
              <option value="ALL">All</option>
            </select>
          </Field>
          <Field label="Exclude words" hint="Hide titles containing any of these, e.g. lot, reprint, custom, digital" className="col-span-2 sm:col-span-4">
            <input name="x" defaultValue={search ? excludeWordsText(search.exclude ?? []) : (params.x ?? "")} placeholder="lot, reprint, custom" maxLength={300} className={inputCls} />
          </Field>
          <div className="col-span-2 flex items-end justify-end">
            <SubmitButton tone="neutral">Search newest listings</SubmitButton>
          </div>
        </form>

        {!connected && !search && <p className="mt-3 text-xs text-faint">Live search switches on once your eBay developer keys are added.</p>}
        {!connected && search && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Can&apos;t search yet — eBay isn&apos;t connected.</span>
          </div>
        )}
        {result && !result.ok && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        {result && result.ok && search && (
          <div className="mt-5">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-panel-2 p-3 sm:flex-row sm:items-end">
              <form action={addSavedSearchAction} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="q" value={search.q} />
                <input type="hidden" name="market" value={search.market} />
                <input type="hidden" name="category" value={search.category} />
                <input type="hidden" name="format" value={search.format} />
                <input type="hidden" name="max" value={search.maxPrice ?? ""} />
                <input type="hidden" name="x" value={excludeWordsText(search.exclude ?? [])} />
                <Field label="Save this search as" className="flex-1">
                  <input name="name" defaultValue={search.q} maxLength={80} className={inputCls} />
                </Field>
                <SubmitButton>Save search</SubmitButton>
              </form>
            </div>
            <p className="mb-3 text-xs text-warn">
              Profit is shown only for cards in your <Link href="/values" className="underline">Card Values</Link> — it compares the
              asking price with <strong>your</strong> value, not verified sold data.
            </p>
            {result.data.items.length === 0 ? (
              <p className="text-sm text-muted">No listings found. Try fewer words or a higher max price.</p>
            ) : (
              <ul className="divide-y divide-line">
                {result.data.items.map((l) => {
                  const h = evaluateListing(l, settings, values.map);
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
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                          <Tag>{l.isAuction ? `Auction${l.bidCount !== null ? ` · ${l.bidCount} bids` : ""}` : l.acceptsOffers ? "Buy It Now · Offers" : "Buy It Now"}</Tag>
                          {l.isAuction && endsIn(l.endsAt) && <Tag tone="warn">{endsIn(l.endsAt)}</Tag>}
                          {l.country && <Tag>{l.country}</Tag>}
                          {h.valueUsd !== null ? (
                            h.meetsCriteria ? (
                              <span className="rounded-md bg-gain-soft px-1.5 py-0.5 font-medium text-gain">Meets your rules</span>
                            ) : (
                              <span className="rounded-md bg-loss-soft px-1.5 py-0.5 font-medium text-loss">Below your rules</span>
                            )
                          ) : (
                            <span>No value saved for this card</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Money usd={h.priceUsd} fx={fx} size="sm" align="right" />
                        {h.netProfitUsd !== null && (
                          <div className="mt-1 flex items-center justify-end gap-2">
                            <Money usd={h.netProfitUsd} fx={fx} size="sm" tone="auto" align="right" />
                            <Pct value={h.roiPercent} />
                          </div>
                        )}
                        <Link href={`/analyse?item=${l.itemId}&market=${search.market}`} className="mt-1 block text-xs text-accent hover:underline">
                          Analyse →
                        </Link>
                        {h.valueUsd === null && (
                          <Link href={addValueHref(l.title, l.itemId)} className="mt-1 block text-xs text-gain hover:underline">
                            + Add value
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">
              Showing {result.data.items.length} of {result.data.total.toLocaleString("en-AU")} · newest first · source: eBay Browse API
              {result.data.excluded > 0 ? ` · ${result.data.excluded} hidden by your exclude words` : ""}
            </p>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Saved searches ---------- */}
        <Panel
          title="Saved searches"
          className="lg:col-span-2"
          right={
            <form action={scanNowAction}>
              <SubmitButton tone="neutral">Scan now</SubmitButton>
            </form>
          }
        >
          {saved.data.length === 0 ? (
            <p className="text-sm text-muted">
              None yet. Run a search above and click <strong>Save search</strong> — every active saved search is checked on each scan.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {saved.data.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className={`h-2 w-2 rounded-full ${s.active ? "bg-gain" : "bg-faint"}`} />
                      {s.name}
                    </div>
                    <div className="text-xs text-faint">
                      “{s.query}” · {s.market === "EBAY_AU" ? "eBay AU" : "eBay US"} · {FORMAT_LABEL[s.format]}
                      {s.maxPrice ? ` · ≤ ${s.market === "EBAY_AU" ? "A$" : "US$"}${s.maxPrice}` : ""}
                    </div>
                    <form action={updateSavedSearchExcludeAction} className="mt-1.5 flex items-center gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        name="x"
                        defaultValue={s.excludeWords}
                        placeholder="Exclude words, e.g. lot, reprint"
                        aria-label={`Exclude words for ${s.name}`}
                        maxLength={300}
                        className="w-56 rounded-md border border-line bg-panel-2 px-2 py-1 text-xs"
                      />
                      <button className="text-xs text-accent hover:underline">Save</button>
                    </form>
                    <div className="text-xs text-faint">
                      Last checked {ago(s.lastRunAt)}
                      {s.lastRunStatus ? ` · ${s.lastRunStatus}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={toggleSavedSearchAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                      <button className="text-xs text-accent hover:underline">{s.active ? "Pause" : "Resume"}</button>
                    </form>
                    <form action={deleteSavedSearchAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-muted hover:text-loss">Remove</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---------- Status ---------- */}
        <Panel title="Scanner status">
          <div className="divide-y divide-line">
            <StatusRow label="eBay Browse API" status={connected ? "ok" : "off"} detail={connected ? "Live listings" : "Needs eBay keys"} />
            <StatusRow
              label="Schedule (every 3 hours)"
              status={scheduleHealthy ? "ok" : "off"}
              detail={lastScheduled ? `Last scheduled scan ${ago(lastScheduled.createdAt)}` : "No scheduled scan has run yet"}
            />
            <StatusRow label="Email alerts" status={emailConfigured() ? "ok" : "off"} detail={emailConfigured() ? "Resend connected" : "Add RESEND_API_KEY + ALERT_EMAIL"} />
            <StatusRow
              label="Phone notifications"
              status={pushConfigured() && devices.data.length > 0 ? "ok" : "off"}
              detail={!pushConfigured() ? "Add VAPID keys in Vercel" : devices.data.length > 0 ? `${devices.data.length} device${devices.data.length === 1 ? "" : "s"}` : "Turn on in Settings"}
            />
            <StatusRow label="Card values" status={values.map.size > 0 ? "ok" : "off"} detail={`${values.map.size} saved — needed to spot deals`} />
          </div>
          {runs.data.length > 0 && (
            <ul className="mt-3 space-y-1 text-[11px] text-faint">
              {runs.data.map((r) => (
                <li key={r.createdAt}>
                  {ago(r.createdAt)} · {r.trigger} · {r.newListings} new · {r.deals} deals{r.error ? ` · ⚠ ${r.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---------- Results ---------- */}
      <Panel
        title="Latest scan results"
        className="mt-6"
        right={
          <Link href={qs({ deals: !onlyDeals, auctions: showAllAuctions })} className="text-xs text-accent hover:underline">
            {onlyDeals ? "Show all" : `Show deals only (${dealCount})`}
          </Link>
        }
      >
        <p className="mb-3 text-xs text-faint">
          Profit and &ldquo;Deal&rdquo; are recalculated with your current Card Values and Settings each time this page opens. Older
          listings may have sold since they were found.
        </p>
        {early.length > 0 && (
          <p className="mb-3 text-xs text-faint">
            {showAllAuctions ? (
              <>
                Showing {early.length} auction{early.length === 1 ? "" : "s"} with more than a day left — their current bids aren&apos;t
                meaningful yet.{" "}
                <Link href={qs({ deals: onlyDeals })} className="text-accent hover:underline">Hide them</Link>
              </>
            ) : (
              <>
                {early.length} auction{early.length === 1 ? "" : "s"} hidden until the last 24 hours (early bids don&apos;t show the real price).{" "}
                <Link href={qs({ deals: onlyDeals, auctions: true })} className="text-accent hover:underline">Show them</Link>
              </>
            )}
          </p>
        )}
        <DbError error={hits.error} />
        {shownHits.length === 0 ? (
          <p className="text-sm text-muted">
            {onlyDeals
              ? "No found listings meet your rules with your current Card Values."
              : "No scan results yet. Save a search, then click Scan now."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shownHits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3">
                {h.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover ring-1 ring-line" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-panel-2 ring-1 ring-line" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="line-clamp-1 text-sm hover:text-accent">
                    {h.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                    <span>{searchNames.get(h.searchId) ?? "Search"}</span>
                    <span>· found {ago(h.createdAt)}</span>
                    {h.isAuction && <Tag tone="warn">Auction{endsIn(h.endsAt) ? ` · ${endsIn(h.endsAt)}` : ""}</Tag>}
                    {h.meetsCriteria && <span className="rounded-md bg-gain-soft px-1.5 py-0.5 font-medium text-gain">Deal</span>}
                    {h.alerted && <Tag>Emailed</Tag>}
                    {h.valueUsd === null &&
                      (h.cardKey ? (
                        <span>· no value saved for this card</span>
                      ) : (
                        <span title="The listing doesn't state every detail needed to match exactly (year, set, number, parallel, grade)">
                          · card details unclear — use Analyse
                        </span>
                      ))}
                  </div>
                </div>
                <div className="text-right">
                  <Money usd={h.priceUsd} fx={fx} size="sm" align="right" />
                  {h.netProfitUsd !== null && (
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <Money usd={h.netProfitUsd} fx={fx} size="sm" tone="auto" align="right" />
                      <Pct value={h.roiPercent} />
                    </div>
                  )}
                  <Link href={`/analyse?item=${h.itemId}`} className="mt-1 block text-xs text-accent hover:underline">
                    Analyse →
                  </Link>
                  {h.valueUsd === null && (
                    <Link href={addValueHref(h.title, h.itemId)} className="mt-1 block text-xs text-gain hover:underline">
                      + Add value
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
