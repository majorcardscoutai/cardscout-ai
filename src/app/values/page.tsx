import { addCardValueAction, deleteCardValueAction, updateCardValueAction } from "@/app/actions";
import CardThumb from "@/components/CardThumb";
import { CardFields, CurrencyPicker, DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { Money, PageHeader, Panel, Tag } from "@/components/ui";
import { listCardValues } from "@/data/db";
import { loadSettings } from "@/data/source";
import { cardFromListing } from "@/lib/ebay/parse";

export const dynamic = "force-dynamic";

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function CardValuesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; from?: string }>;
}) {
  const { saved, error, from: rawFrom } = await searchParams;
  // "Add value" from a scan result: prefill the form from the listing title (a suggestion to check, never final).
  const from = rawFrom ? rawFrom.slice(0, 200) : null;
  const suggestion = from ? cardFromListing(from) : null;
  const [{ settings }, values] = await Promise.all([loadSettings(), listCardValues()]);
  const fx = settings.usdToAud;

  return (
    <>
      <PageHeader
        title="Card Values"
        subtitle="Your value for each exact card. Set it once — searches, Analyse and automatic scans reuse it to work out profit."
      />
      <Flash saved={saved} error={error} />
      <DbError error={values.error} />

      <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
        These are <strong>your own estimates</strong> (e.g. from eBay sold listings), not verified market data. A value only
        applies to the exact same card, parallel and grade. Update them as the market moves — the age is shown on each.
      </div>

      {values.data.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-line">
          <ul className="divide-y divide-line bg-panel">
            {values.data.map((v) => {
              const stale = Date.now() - new Date(v.updatedAt).getTime() > 30 * 86_400_000;
              return (
                <li key={v.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CardThumb card={v.card} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{v.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Tag tone={stale ? "warn" : "default"}>Updated {age(v.updatedAt)}</Tag>
                        {v.note && <span className="text-xs text-faint">{v.note}</span>}
                      </div>
                    </div>
                  </div>
                  <Money usd={v.valueUsd} fx={fx} />
                  <form action={updateCardValueAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="currency" value="USD" />
                    <input name="value" inputMode="decimal" defaultValue={v.valueUsd} aria-label="New value in US$" className="num w-28 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-sm" />
                    <SubmitButton tone="neutral">Update</SubmitButton>
                  </form>
                  <form action={deleteCardValueAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className="text-xs text-muted hover:text-loss">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div id="add" className="scroll-mt-24">
      <Panel title="Add a card value" right={<Tag>{values.data.length} saved</Tag>}>
        {suggestion && from && (
          <div className="mb-5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm">
            <div className="text-xs text-faint">Filled in from the listing title — check every field against the card:</div>
            <div className="mt-1 font-medium">{from}</div>
            {suggestion.missing.length > 0 && (
              <div className="mt-2 text-xs text-warn">
                The title doesn&apos;t say: <strong>{suggestion.missing.join(", ")}</strong>. Fill these in yourself — open the
                listing if you&apos;re not sure.
              </div>
            )}
            <div className="mt-2 text-xs text-faint">
              Use what this card <strong>sells</strong> for (eBay sold listings), not asking prices.
            </div>
          </div>
        )}
        <form action={addCardValueAction} className="space-y-5">
          {from && (
            <>
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="returnTo" value="/scanner" />
            </>
          )}
          <CardFields key={from ?? "blank"} card={suggestion?.card} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CurrencyPicker defaultValue="USD" />
            <Field label="Your value (what it typically sells for)">
              <input name="value" required inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Note" hint="e.g. based on last 5 sold" className="col-span-2">
              <input name="note" maxLength={300} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton>Save value</SubmitButton>
          </div>
        </form>
      </Panel>
      </div>
      <p className="mt-3 text-xs text-faint">
        Tip: click <strong>Add value</strong> on any Automatic Scanner result to fill this in from the listing. Or in the Manual Scanner, tick “Remember this resale as my value” when saving to the watchlist — it lands here
        automatically. Saving the same card again updates its value.
      </p>
    </>
  );
}
