import Link from "next/link";
import { removeWatchlistAction } from "@/app/actions";
import CardThumb from "@/components/CardThumb";
import { DbError, Flash } from "@/components/FormBits";
import { Money, PageHeader, Pct, Tag } from "@/components/ui";
import { listWatchlist, loadSettings } from "@/data/source";
import { calculateProfit, maxPurchasePrice } from "@/lib/profit";

export const dynamic = "force-dynamic";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const [{ settings }, { data: items, error: dbError }] = await Promise.all([loadSettings(), listWatchlist()]);
  const fx = settings.usdToAud;

  return (
    <>
      <PageHeader
        title="Watchlist"
        subtitle="Cards you're tracking. Profit is recalculated with your current settings every time you open this page."
        action={
          <Link href="/analyse" className="rounded-lg bg-gain px-4 py-2 text-sm font-semibold text-bg hover:bg-gain/90">
            + Add a card
          </Link>
        }
      />
      <Flash saved={saved} error={error} />
      <DbError error={dbError} />

      {items.length === 0 && !dbError ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">Your watchlist is empty.</p>
          <Link href="/analyse" className="mt-3 inline-block text-sm text-accent hover:underline">
            Analyse a card in the Manual Scanner →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((w) => {
            const profit =
              w.expectedResaleUsd === null
                ? null
                : calculateProfit({
                    purchasePriceUsd: w.askingPriceUsd,
                    buyerShippingUsd: w.buyerShippingUsd,
                    expectedResaleUsd: w.expectedResaleUsd,
                    settings,
                  });
            const maxPrice =
              w.expectedResaleUsd === null ? null : maxPurchasePrice(w.expectedResaleUsd, w.buyerShippingUsd, settings);
            const meets =
              profit !== null &&
              profit.roiPercent >= settings.minRoiPercent &&
              profit.netProfitUsd >= settings.minProfitUsd;

            return (
              <article key={w.id} className="flex flex-col rounded-xl border border-line bg-panel p-4">
                <div className="flex gap-3">
                  <CardThumb card={w.card} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{w.title}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag>Your estimate</Tag>
                      {profit &&
                        (meets ? (
                          <span className="rounded-md bg-gain-soft px-1.5 py-0.5 text-[11px] font-medium text-gain">Meets criteria</span>
                        ) : (
                          <span className="rounded-md bg-loss-soft px-1.5 py-0.5 text-[11px] font-medium text-loss">Below your rules</span>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div>
                    <div className="text-[11px] text-faint">Asking</div>
                    <Money usd={w.askingPriceUsd} fx={fx} size="sm" />
                  </div>
                  <div>
                    <div className="text-[11px] text-faint">Est. resale</div>
                    <Money usd={w.expectedResaleUsd} fx={fx} size="sm" />
                  </div>
                  <div>
                    <div className="text-[11px] text-faint">Net · ROI</div>
                    <Money usd={profit?.netProfitUsd} fx={fx} size="sm" tone="auto" />
                    <div><Pct value={profit?.roiPercent} /></div>
                  </div>
                  <div>
                    <div className="text-[11px] text-faint">Max buy</div>
                    <Money usd={maxPrice} fx={fx} size="sm" />
                  </div>
                  <div>
                    <div className="text-[11px] text-faint">Your target</div>
                    <Money usd={w.targetPriceUsd} fx={fx} size="sm" />
                  </div>
                </div>

                {w.note && <p className="mt-3 rounded-md bg-panel-2 px-3 py-2 text-xs text-muted">{w.note}</p>}

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                  {w.listingUrl ? (
                    <a href={w.listingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                      View listing ↗
                    </a>
                  ) : (
                    <span className="text-xs text-faint">No listing link</span>
                  )}
                  <form action={removeWatchlistAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="text-xs text-muted hover:text-loss">Remove</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
