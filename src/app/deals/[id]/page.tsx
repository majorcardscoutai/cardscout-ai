import Link from "next/link";
import { notFound } from "next/navigation";
import CardThumb from "@/components/CardThumb";
import { IconArrowLeft, IconCheck, IconX } from "@/components/Icons";
import {
  ConfidenceBadge,
  DemoBanner,
  Money,
  Panel,
  Pct,
  ScoreBadge,
  Tag,
} from "@/components/ui";
import { getAssessment, getAsOf, getSettings } from "@/data/source";
import { cardDescription } from "@/lib/analysis";
import { formatMoney } from "@/lib/currency";
import { scoreLabel } from "@/lib/scoring";
import { daysBetween } from "@/lib/valuation";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  const a = getAssessment(id, settings);
  if (!a) notFound();

  const fx = settings.usdToAud;
  const asOf = getAsOf();
  const { listing, valuation, profit, score } = a;
  const card = listing.card;

  const identity: [string, string][] = [
    ["Player / subject", card.player],
    ["Year", String(card.year)],
    ["Set", card.set],
    ["Card number", `#${card.cardNumber}`],
    ["Parallel", card.parallel ?? "Base"],
    ["Serial numbered", card.serialNumbered ? `/${card.serialNumbered}` : "No"],
    ["Variation", card.variation ?? "None"],
    ["Rookie", card.isRookie ? "Yes" : "No"],
    ["Grade", card.grader === "RAW" ? "Raw (ungraded)" : `${card.grader} ${card.grade}`],
  ];

  return (
    <>
      <Link href="/deals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconArrowLeft className="h-4 w-4" /> Top Deals
      </Link>
      {listing.isDemo && (
        <DemoBanner>
          This listing and its sold comparisons are invented for testing. There is no real eBay listing behind it.
        </DemoBanner>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-5 rounded-xl border border-line bg-panel p-5 sm:flex-row">
        <CardThumb card={card} imageUrl={listing.imageUrl} size="lg" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{listing.title}</h1>
              <p className="mt-1 text-sm text-muted">{cardDescription(card)}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ScoreBadge score={score.total} size="lg" />
              <span className="text-[11px] text-faint">/ 100</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Tag>{listing.format.replaceAll("_", " ").toLowerCase()}</Tag>
            <ConfidenceBadge confidence={valuation.confidence} />
            <Tag>Ships from {listing.shipsFromCountry}</Tag>
            {a.meetsCriteria ? (
              <span className="rounded-md bg-gain-soft px-1.5 py-0.5 text-[11px] font-medium text-gain">Meets your criteria</span>
            ) : (
              <span className="rounded-md bg-loss-soft px-1.5 py-0.5 text-[11px] font-medium text-loss">Doesn&apos;t meet your criteria</span>
            )}
          </div>
          <p className="mt-3 text-sm font-medium">{scoreLabel(score.total)}</p>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted">Asking price</div>
              <Money usd={listing.askingPriceUsd} fx={fx} size="lg" />
            </div>
            <div>
              <div className="text-xs text-muted">Est. market value</div>
              <Money usd={valuation.estimatedValueUsd} fx={fx} size="lg" />
            </div>
            <div>
              <div className="text-xs text-muted">Net profit</div>
              <Money usd={profit?.netProfitUsd} fx={fx} size="lg" tone="auto" />
            </div>
            <div>
              <div className="text-xs text-muted">ROI</div>
              <div className="mt-1 text-2xl"><Pct value={profit?.roiPercent} /></div>
            </div>
          </div>
          <div className="mt-4">
            {listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                View listing on eBay ↗
              </a>
            ) : (
              <span className="text-sm text-faint">No listing link — demo data</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Buying guide">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <div className="text-xs text-muted">Recommended opening offer</div>
                <div className="mt-1">
                  {listing.format === "AUCTION" ? (
                    <span className="text-sm text-faint">Auction — bid up to max price</span>
                  ) : (
                    <Money usd={a.openingOfferUsd} fx={fx} />
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <div className="text-xs text-muted">Maximum profitable price</div>
                <div className="mt-1"><Money usd={a.maxPurchaseUsd} fx={fx} /></div>
              </div>
              <div className="rounded-lg bg-panel-2 p-3 ring-1 ring-line">
                <div className="text-xs text-muted">Expected resale</div>
                <div className="mt-1"><Money usd={a.expectedResaleUsd} fx={fx} /></div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Max price = the most you can pay (before import GST and shipping) and still clear {settings.minRoiPercent}% ROI and{" "}
              {formatMoney(settings.minProfitUsd, "USD")} profit. Expected resale applies a confidence haircut to market value
              (high 0%, medium 5%, low 10%). The opening offer is a rule of thumb, not market data.
            </p>
          </Panel>

          <Panel title="Profit breakdown">
            {profit ? (
              <dl className="divide-y divide-line text-sm">
                {[
                  ["Purchase price", profit.purchasePriceUsd, 1],
                  [`Import GST (${settings.importTaxRate * 100}%)`, profit.importTaxUsd, 1],
                  ["Shipping to you", profit.buyerShippingUsd, 1],
                  ["Other costs", profit.otherCostsUsd, 1],
                  ["Total acquisition cost", profit.totalAcquisitionCostUsd, 0],
                  ["Expected resale", profit.expectedResaleUsd, 0],
                  [`Marketplace fees (${(settings.marketplaceFeeRate * 100).toFixed(2)}% + ${formatMoney(settings.marketplaceFixedFeeUsd, "USD")})`, -profit.marketplaceFeesUsd, 0],
                  ["Shipping to buyer", -profit.outboundShippingUsd, 0],
                ].map(([label, v, indent]) => (
                  <div key={label as string} className="flex items-center justify-between py-2">
                    <dt className={indent ? "pl-3 text-muted" : "font-medium"}>{label}</dt>
                    <dd><Money usd={v as number} fx={fx} size="sm" align="right" /></dd>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <dt className="font-semibold">Net profit · ROI</dt>
                  <dd className="flex items-center gap-4">
                    <Pct value={profit.roiPercent} />
                    <Money usd={profit.netProfitUsd} fx={fx} tone="auto" align="right" />
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">
                Profit can&apos;t be calculated without a verified market value.
              </p>
            )}
          </Panel>

          <Panel
            title="Sold comparisons used"
            right={<span className="text-xs text-faint">{valuation.basis === "insufficient" ? "Insufficient" : `${valuation.compsUsed.length} used · ${valuation.basis} match`}</span>}
          >
            {valuation.compsUsed.length > 0 ? (
              <div className="-mx-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="px-4 pb-2 text-left font-medium">Sold</th>
                      <th className="px-2 pb-2 text-left font-medium">Type</th>
                      <th className="px-2 pb-2 text-left font-medium">Match</th>
                      <th className="px-4 pb-2 text-right font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...valuation.compsUsed]
                      .sort((x, y) => y.soldDate.localeCompare(x.soldDate))
                      .map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-2 text-muted">{Math.round(daysBetween(c.soldDate, asOf))}d ago</td>
                          <td className="px-2 py-2 text-muted">
                            {c.saleType === "BEST_OFFER_ACCEPTED" ? "Best Offer (½ weight)" : c.saleType === "AUCTION" ? "Auction" : "Buy It Now"}
                          </td>
                          <td className="px-2 py-2 text-muted">{c.match}</td>
                          <td className="px-4 py-2 text-right">
                            {c.sourceUrl ? (
                              <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                {formatMoney(c.soldPriceUsd, "USD")}
                              </a>
                            ) : (
                              <span className="num">{formatMoney(c.soldPriceUsd, "USD")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">No usable sold comparisons.</p>
            )}
            {valuation.compsExcluded.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs text-muted">
                  {valuation.compsExcluded.length} comparison(s) excluded
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-faint">
                  {valuation.compsExcluded.map(({ comp, reason }) => (
                    <li key={comp.id}>
                      {formatMoney(comp.soldPriceUsd, "USD")} · {Math.round(daysBetween(comp.soldDate, asOf))}d ago — {reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-3 text-xs text-faint">
              Source: {valuation.compsUsed[0]?.source ?? valuation.compsExcluded[0]?.comp.source ?? "none"}. Range{" "}
              {valuation.lowUsd !== null ? `${formatMoney(valuation.lowUsd, "USD")}–${formatMoney(valuation.highUsd ?? 0, "USD")}` : "n/a"}
              {valuation.spreadPercent !== null ? ` · spread ±${valuation.spreadPercent}%` : ""}
            </p>
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Panel title="Score breakdown" right={score.cappedBy ? <Tag tone="warn">Capped: {score.cappedBy} confidence</Tag> : undefined}>
            {score.factors.length === 0 ? (
              <p className="text-sm text-muted">Not scored — there is no verified market value to score against.</p>
            ) : (
              <ul className="space-y-3">
                {score.factors.map((f) => (
                  <li key={f.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{f.label}</span>
                      <span className="num text-muted">
                        {f.points}/{f.max}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <div
                        className={`h-full rounded-full ${f.missingData ? "bg-warn" : "bg-gain"}`}
                        style={{ width: `${(f.points / f.max) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-faint">{f.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Reasons to buy">
            {a.reasonsToBuy.length ? (
              <ul className="space-y-2 text-sm">
                {a.reasonsToBuy.map((r) => (
                  <li key={r} className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-gain" />{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None found.</p>
            )}
          </Panel>

          <Panel title="Reasons to avoid / risks">
            {a.reasonsToAvoid.length ? (
              <ul className="space-y-2 text-sm">
                {a.reasonsToAvoid.map((r) => (
                  <li key={r} className="flex gap-2"><IconX className="mt-0.5 h-4 w-4 shrink-0 text-loss" />{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None found.</p>
            )}
          </Panel>

          <Panel title="Card identification">
            <dl className="space-y-1.5 text-sm">
              {identity.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Population</dt>
                <dd className="text-right text-warn">{a.population ? a.population.population : "Not available"}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
