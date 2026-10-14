import Link from "next/link";
import { DbError } from "@/components/FormBits";
import { formatMoney } from "@/lib/currency";
import { Money, PageHeader, Panel, Pct, Tag } from "@/components/ui";
import { currentDeals, sortDeals, type DealHit, type DealSort } from "@/data/deals";

export const dynamic = "force-dynamic";

const SORTS: { key: DealSort; label: string }[] = [
  { key: "profit", label: "Profit" },
  { key: "roi", label: "ROI" },
  { key: "newest", label: "Newest" },
  { key: "price", label: "Price" },
];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function endsIn(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 60) return `ends in ${Math.max(mins, 0)}m`;
  return `ends in ${Math.round(mins / 60)}h`;
}

function DealRow({ d, fx, rank }: { d: DealHit; fx: number; rank?: number }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {rank !== undefined && <span className="num w-6 shrink-0 text-right text-sm text-faint">{rank}</span>}
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imageUrl} alt="" className="h-16 w-12 shrink-0 rounded object-cover ring-1 ring-line" />
        ) : (
          <div className="h-16 w-12 shrink-0 rounded bg-panel-2 ring-1 ring-line" />
        )}
        <div className="min-w-0">
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-medium hover:text-accent">
            {d.title}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
            {d.isAuction ? <Tag tone="warn">Auction · {endsIn(d.endsAt) ?? "end time unknown"}</Tag> : <Tag>Buy It Now</Tag>}
            <span>{d.searchName}</span>
            <span>· found {ago(d.createdAt)}</span>
            {!d.meetsCriteria && d.maxPriceUsd !== null && d.maxPriceUsd > 0 && (
              <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-ink">
                Your max: {formatMoney(d.maxPriceUsd, "USD")} · {formatMoney(d.maxPriceUsd * fx, "AUD")}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 text-right sm:w-[420px]">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Price</div>
          <Money usd={d.priceUsd} fx={fx} size="sm" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Your value</div>
          <Money usd={d.valueUsd} fx={fx} size="sm" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Profit</div>
          <Money usd={d.netProfitUsd} fx={fx} size="sm" tone="auto" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">ROI</div>
          <div className="text-sm"><Pct value={d.roiPercent} /></div>
          <Link href={`/analyse?item=${d.itemId}`} className="mt-1 block text-xs text-accent hover:underline">
            Analyse →
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function TopDealsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: rawSort } = await searchParams;
  const sort: DealSort = SORTS.some((s) => s.key === rawSort) ? (rawSort as DealSort) : "profit";
  const { settings, deals, nearMisses, valuedCount, error } = await currentDeals();
  const fx = settings.usdToAud;
  const rows = sortDeals(deals, sort);

  return (
    <>
      <PageHeader
        title="Top Deals"
        subtitle="Live listings from your scans that meet your ROI and profit rules right now, using today's Card Values, settings and exchange rate."
      />
      <DbError error={error} />
      <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
        Profit compares the price with <strong>your own Card Values</strong>, not verified sold data. Listings may have sold or
        changed since they were found — open the listing and check the card before you buy.
      </div>

      <Panel
        title={`Deals meeting your rules (${rows.length})`}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-faint">Sort:</span>
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={s.key === "profit" ? "/deals" : `/deals?sort=${s.key}`}
                className={`rounded-md px-2 py-0.5 ${s.key === sort ? "bg-ink text-bg" : "text-accent hover:underline"}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="text-sm text-muted">
            <p>No live listings meet your rules right now.</p>
            <p className="mt-2 text-xs text-faint">
              {valuedCount === 0
                ? "None of the listings your scans found match a card in your Card Values yet. Click “+ Add value” on scan results for cards you'd buy."
                : `${valuedCount} found listing${valuedCount === 1 ? " has" : "s have"} a value but ${valuedCount === 1 ? "is" : "are"} priced above your max. Auctions appear here in their final 24 hours.`}
            </p>
            <Link href="/scanner" className="mt-3 inline-block text-xs text-accent hover:underline">Open the Automatic Scanner →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((d, i) => (
              <DealRow key={d.id} d={d} fx={fx} rank={i + 1} />
            ))}
          </ul>
        )}
      </Panel>

      {nearMisses.length > 0 && (
        <Panel title="Close to your rules" className="mt-6" right={<Tag>within 15% of your max price</Tag>}>
          <p className="mb-3 text-xs text-faint">
            Priced just above what your rules allow — worth a Best Offer, or worth watching if it&apos;s an auction.
          </p>
          <ul className="divide-y divide-line">
            {nearMisses.slice(0, 10).map((d) => (
              <DealRow key={d.id} d={d} fx={fx} />
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
