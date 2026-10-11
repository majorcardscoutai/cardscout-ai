import Link from "next/link";
import { addHoldingAction, removeHoldingAction } from "@/app/actions";
import CardThumb from "@/components/CardThumb";
import { CardFields, CurrencyPicker, DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { Money, PageHeader, Panel, Pct, StatCard, Tag } from "@/components/ui";
import { listHoldings, loadSettings } from "@/data/source";
import { formatMoney } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const [{ settings }, { data: holdings, error: dbError }] = await Promise.all([loadSettings(), listHoldings()]);
  const fx = settings.usdToAud;

  const totalCost = holdings.reduce((s, h) => s + h.purchasePriceUsd + h.purchaseCostsUsd, 0);
  const valued = holdings.filter((h) => h.estimatedValueUsd !== null);
  const valuedCost = valued.reduce((s, h) => s + h.purchasePriceUsd + h.purchaseCostsUsd, 0);
  const valuedValue = valued.reduce((s, h) => s + (h.estimatedValueUsd ?? 0), 0);
  const unrealised = valuedValue - valuedCost;
  const unvalued = holdings.length - valued.length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Cards you own, what they cost you, and your current estimate of their value."
      />
      <Flash saved={saved} error={error} />
      <DbError error={dbError} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cards held" value={holdings.length} />
        <StatCard label="Total cost basis" value={formatMoney(totalCost, "USD")} sub={formatMoney(totalCost * fx, "AUD")} />
        <StatCard
          label="Est. value (valued cards)"
          value={formatMoney(valuedValue, "USD")}
          sub={`${formatMoney(valuedValue * fx, "AUD")} · ${valued.length} of ${holdings.length} cards`}
        />
        <StatCard
          label="Unrealised gain / loss"
          value={`${unrealised >= 0 ? "+" : ""}${formatMoney(unrealised, "USD")}`}
          sub={unvalued > 0 ? `Excludes ${unvalued} card(s) without a value` : "Before selling fees"}
          tone={unrealised >= 0 ? "gain" : "loss"}
        />
      </div>

      {holdings.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-12 gap-3 bg-panel-2 px-4 py-3 text-xs text-muted md:grid">
            <div className="col-span-5">Card</div>
            <div className="col-span-2 text-right">Cost basis</div>
            <div className="col-span-2 text-right">Est. value</div>
            <div className="col-span-2 text-right">Gain / loss</div>
            <div className="col-span-1 text-right">Return</div>
          </div>
          <ul className="divide-y divide-line bg-panel">
            {holdings.map((h) => {
              const cost = h.purchasePriceUsd + h.purchaseCostsUsd;
              const gain = h.estimatedValueUsd === null ? null : h.estimatedValueUsd - cost;
              const ret = gain === null || cost === 0 ? null : Math.round((gain / cost) * 1000) / 10;
              return (
                <li key={h.id} className="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-12 md:items-center">
                  <div className="col-span-2 flex items-center gap-3 md:col-span-5">
                    <CardThumb card={h.card} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{h.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Tag>Bought {h.purchasedAt}</Tag>
                        {h.estimatedValueUsd !== null && <Tag>Your estimate</Tag>}
                        <Link href={`/portfolio/${h.id}/edit`} className="text-[11px] text-accent hover:underline">
                          Edit
                        </Link>
                        <form action={removeHoldingAction}>
                          <input type="hidden" name="id" value={h.id} />
                          <button className="text-[11px] text-muted hover:text-loss">Remove</button>
                        </form>
                      </div>
                      {h.note && <div className="mt-1 text-xs text-faint">{h.note}</div>}
                    </div>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <div className="text-[11px] text-faint md:hidden">Cost basis</div>
                    <Money usd={cost} fx={fx} size="sm" />
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <div className="text-[11px] text-faint md:hidden">Est. value</div>
                    <Money usd={h.estimatedValueUsd} fx={fx} size="sm" />
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <div className="text-[11px] text-faint md:hidden">Gain / loss</div>
                    <Money usd={gain} fx={fx} size="sm" tone="auto" />
                  </div>
                  <div className="md:col-span-1 md:text-right">
                    <div className="text-[11px] text-faint md:hidden">Return</div>
                    <Pct value={ret} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Panel title="Add a card you own" className="mt-6">
        <form action={addHoldingAction} className="space-y-5">
          <CardFields />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CurrencyPicker />
            <Field label="Purchase price">
              <input name="purchasePrice" required inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Extra costs" hint="Shipping, GST, grading…">
              <input name="purchaseCosts" inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Date bought">
              <input name="purchasedAt" type="date" defaultValue={today} max={today} className={inputCls} />
            </Field>
            <Field label="Your current value estimate" hint="Optional — leave blank if unsure" className="col-span-2">
              <input name="estimatedValue" inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Note" className="col-span-2">
              <input name="note" maxLength={500} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton>Add to portfolio</SubmitButton>
          </div>
        </form>
      </Panel>
      <p className="mt-3 text-xs text-faint">
        Values are your own estimates until verified sold data is connected (Phase 3). Value-over-time charts come in Phase 5.
      </p>
    </>
  );
}
