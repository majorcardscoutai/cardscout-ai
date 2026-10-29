import Link from "next/link";
import { DbError } from "@/components/FormBits";
import ProviderCredit from "@/components/ProviderCredit";
import { DealRow } from "@/components/DealRow";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { currentDeals, sortDeals, type DealSort } from "@/data/deals";
import { displayFx } from "@/lib/region";

export const dynamic = "force-dynamic";

const SORTS: { key: DealSort; label: string }[] = [
  { key: "profit", label: "Profit" },
  { key: "roi", label: "ROI" },
  { key: "newest", label: "Newest" },
  { key: "price", label: "Price" },
];

export default async function TopDealsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: rawSort } = await searchParams;
  const sort: DealSort = SORTS.some((s) => s.key === rawSort) ? (rawSort as DealSort) : "profit";
  const { settings, deals, nearMisses, needsCheck, valuedCount, error } = await currentDeals();
  const fx = displayFx(settings); // A$ shown for Australian buyers only
  const rows = sortDeals(deals, sort);

  return (
    <>
      <PageHeader
        title="Top Deals"
        subtitle="Live listings from your scans that meet your ROI and profit rules right now, using today's Card Values, settings and exchange rate."
      />
      <DbError error={error} />
      <ProviderCredit className="-mt-2 mb-4" />
      <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
        Profit compares the price with a market value from SportsCardsPro/PriceCharting, or your own Card Value where you&apos;ve
        set one. Automatic values are matched by the listing title — check it&apos;s the same card (parallel, grade) before you buy.
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

      {needsCheck.length > 0 && (
        <Panel title={`Needs a manual check (${needsCheck.length})`} className="mt-6" right={<Tag tone="warn">too good to be true?</Tag>}>
          <p className="mb-3 text-xs text-faint">
            These look like huge deals — a guide value 3× the price or more, or over 150% ROI. That&apos;s far more often a wrong value
            (an odd sale, the wrong parallel, grade or language) than a real bargain, so they&apos;re never alerted or ranked. Check
            the card against SportsCardsPro yourself; if the value is wrong, tap <strong>Wrong match?</strong>.
          </p>
          <ul className="divide-y divide-line">
            {sortDeals(needsCheck, "profit").map((d) => (
              <li key={d.id} className="py-1">
                <p className="pt-2 text-[11px] text-warn">{d.needsCheck}</p>
                <ul><DealRow d={d} fx={fx} /></ul>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
