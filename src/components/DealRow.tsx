import { DealScore } from "@/components/DealScore";
import { GradePriceWarning } from "@/components/GradePriceWarning";
import { OffCentreWarning } from "@/components/OffCentreWarning";
import Link from "next/link";
import { rejectAutoValueAction } from "@/app/actions";
import { ValueSource } from "@/components/ProviderCredit";

import { Money, Pct, Tag } from "@/components/ui";
import type { DealHit } from "@/lib/deals";
import { EbayLink } from "@/components/EbayLink";

/** One deal row — used by Top Deals and Profit Hunter. */
export function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function endsIn(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 60) return `ends in ${Math.max(mins, 0)}m`;
  return `ends in ${Math.round(mins / 60)}h`;
}

export function DealRow({ d, fx, rank, returnTo = "/deals" }: { d: DealHit; fx: number; rank?: number; returnTo?: "/deals" | "/hunter" }) {
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
            <EbayLink url={d.url} />
            <OffCentreWarning title={d.title} />
            <GradePriceWarning label={d.mixedGrade} />
            {d.needsCheck && (
              <span className="rounded-md bg-warn-soft px-1.5 py-0.5 font-medium text-warn" data-testid="needs-check" title={d.needsCheck}>
                ⚠ Needs a manual check
              </span>
            )}
            <ValueSource source={d.valueSource} />
            <span>{d.searchName}</span>
            {d.salesVolume !== null && d.salesVolume !== undefined && <span>· sells ~{d.salesVolume}/yr</span>}
            <span>· found {ago(d.createdAt)}</span>
            {d.sellerName && <span>· seller {d.sellerName}</span>}
            {/* eBay API licence §8.1.3: say how old the listing details are. */}
            <span>· eBay details checked {ago(d.checkedAt ?? d.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 text-right sm:w-[420px]">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Price</div>
          <Money usd={d.priceUsd} fx={fx} size="sm" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Value</div>
          <Money usd={d.valueUsd} fx={fx} size="sm" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">Profit</div>
          <Money usd={d.netProfitUsd} fx={fx} size="sm" tone="auto" align="right" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint">ROI</div>
          <div className="text-sm"><Pct value={d.roiPercent} /></div>
          {d.score && <div className="mt-1.5"><DealScore score={d.score} /></div>}
          <Link href={`/analyse?item=${d.itemId}`} className="mt-1 block text-xs text-accent hover:underline">
            Analyse →
          </Link>
          {d.valueSource && d.valueSource !== "you" && d.cardKey && (
            <form action={rejectAutoValueAction} className="mt-1">
              <input type="hidden" name="key" value={d.cardKey} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="text-[11px] text-muted hover:text-loss">Wrong match?</button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

