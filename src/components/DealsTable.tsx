"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CardIdentity, Confidence, ListingFormat, Sport } from "@/lib/types";
import CardThumb from "./CardThumb";
import { ConfidenceBadge, Money, Pct, ScoreBadge, Tag } from "./ui";

/** Plain, serialisable row data (built on the server from an Assessment). */
export interface DealRow {
  id: string;
  title: string;
  card: CardIdentity;
  format: ListingFormat;
  askingUsd: number;
  valueUsd: number | null;
  netProfitUsd: number | null;
  roiPercent: number | null;
  maxPurchaseUsd: number | null;
  score: number | null;
  confidence: Confidence;
  meetsCriteria: boolean;
  isDemo: boolean;
}

const FORMAT_LABEL: Record<ListingFormat, string> = {
  BUY_IT_NOW: "Buy It Now",
  AUCTION: "Auction",
  BEST_OFFER: "Best Offer",
};

type SortKey = "score" | "roi" | "profit" | "discount";

export default function DealsTable({ rows, fx }: { rows: DealRow[]; fx: number }) {
  const [sport, setSport] = useState<Sport | "All">("All");
  const [onlyMeets, setOnlyMeets] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");

  const visible = useMemo(() => {
    const discount = (r: DealRow) =>
      r.valueUsd ? (r.valueUsd - r.askingUsd) / r.valueUsd : -Infinity;
    const key: Record<SortKey, (r: DealRow) => number> = {
      score: (r) => r.score ?? -1,
      roi: (r) => r.roiPercent ?? -Infinity,
      profit: (r) => r.netProfitUsd ?? -Infinity,
      discount,
    };
    return rows
      .filter((r) => sport === "All" || r.card.sport === sport)
      .filter((r) => !onlyMeets || r.meetsCriteria)
      .sort((a, b) => key[sort](b) - key[sort](a));
  }, [rows, sport, onlyMeets, sort]);

  const sports: (Sport | "All")[] = ["All", "MLB", "NBA", "Pokemon"];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sports.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              sport === s ? "bg-ink text-bg" : "bg-panel-2 text-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {s === "Pokemon" ? "Pokémon" : s}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={onlyMeets}
            onChange={(e) => setOnlyMeets(e.target.checked)}
            className="accent-gain"
          />
          Meets my criteria
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto rounded-lg border border-line bg-panel-2 px-2 py-1 text-xs text-ink"
          aria-label="Sort deals"
        >
          <option value="score">Sort: Score</option>
          <option value="roi">Sort: ROI</option>
          <option value="profit">Sort: Net profit</option>
          <option value="discount">Sort: Discount</option>
        </select>
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No deals match these filters.
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Card</th>
              <th className="px-3 py-3 text-right font-medium">Asking</th>
              <th className="px-3 py-3 text-right font-medium">Est. market</th>
              <th className="px-3 py-3 text-right font-medium">Net profit</th>
              <th className="px-3 py-3 text-right font-medium">ROI</th>
              <th className="px-3 py-3 text-right font-medium">Max buy</th>
              <th className="px-4 py-3 text-center font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-panel">
            {visible.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-panel-2/60">
                <td className="px-4 py-3">
                  <Link href={`/deals/${r.id}`} className="flex items-center gap-3">
                    <CardThumb card={r.card} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate font-medium hover:text-accent">{r.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Tag>{FORMAT_LABEL[r.format]}</Tag>
                        <ConfidenceBadge confidence={r.confidence} />
                        {r.meetsCriteria && (
                          <span className="rounded-md bg-gain-soft px-1.5 py-0.5 text-[11px] font-medium text-gain">
                            Meets criteria
                          </span>
                        )}
                        {r.isDemo && <Tag tone="warn">Demo</Tag>}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right"><Money usd={r.askingUsd} fx={fx} align="right" /></td>
                <td className="px-3 py-3 text-right"><Money usd={r.valueUsd} fx={fx} align="right" /></td>
                <td className="px-3 py-3 text-right"><Money usd={r.netProfitUsd} fx={fx} tone="auto" align="right" /></td>
                <td className="px-3 py-3 text-right"><Pct value={r.roiPercent} /></td>
                <td className="px-3 py-3 text-right"><Money usd={r.maxPurchaseUsd} fx={fx} align="right" /></td>
                <td className="px-4 py-3"><div className="flex justify-center"><ScoreBadge score={r.score} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="grid gap-3 lg:hidden">
        {visible.map((r) => (
          <Link
            key={r.id}
            href={`/deals/${r.id}`}
            className="rounded-xl border border-line bg-panel p-4 active:bg-panel-2"
          >
            <div className="flex gap-3">
              <CardThumb card={r.card} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug">{r.title}</div>
                  <ScoreBadge score={r.score} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag>{FORMAT_LABEL[r.format]}</Tag>
                  <ConfidenceBadge confidence={r.confidence} />
                  {r.isDemo && <Tag tone="warn">Demo</Tag>}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
              <div>
                <div className="mb-0.5 text-[11px] text-faint">Asking</div>
                <Money usd={r.askingUsd} fx={fx} size="sm" />
              </div>
              <div>
                <div className="mb-0.5 text-[11px] text-faint">Est. market</div>
                <Money usd={r.valueUsd} fx={fx} size="sm" />
              </div>
              <div>
                <div className="mb-0.5 text-[11px] text-faint">Net profit · ROI</div>
                <Money usd={r.netProfitUsd} fx={fx} size="sm" tone="auto" />
                <div><Pct value={r.roiPercent} /></div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
