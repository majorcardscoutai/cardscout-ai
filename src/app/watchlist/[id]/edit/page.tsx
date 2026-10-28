import Link from "next/link";
import { notFound } from "next/navigation";
import { updateWatchlistAction } from "@/app/actions";
import { CardFields, CurrencyPicker, DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { IconArrowLeft } from "@/components/Icons";
import { PageHeader, Panel } from "@/components/ui";
import { getWatchlistItem } from "@/data/db";

export const dynamic = "force-dynamic";

const v = (n: number | null) => (n === null ? "" : String(n));

export default async function EditWatchlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { data: w, error: dbError } = await getWatchlistItem(id);
  if (!w && !dbError) notFound();

  return (
    <>
      <Link href="/watchlist" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconArrowLeft className="h-4 w-4" /> Watchlist
      </Link>
      <PageHeader title="Edit watchlist card" subtitle="Prices are shown in US$, the currency they're stored in. You can switch to AUD before saving." />
      <Flash error={error} />
      <DbError error={dbError} />

      {w && (
        <Panel>
          <form action={updateWatchlistAction} className="space-y-5">
            <input type="hidden" name="id" value={w.id} />
            <CardFields card={w.card} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CurrencyPicker defaultValue="USD" />
              <Field label="Asking price">
                <input name="asking" required inputMode="decimal" defaultValue={v(w.askingPriceUsd)} className={inputCls} />
              </Field>
              <Field label="Shipping to you">
                <input name="shipping" inputMode="decimal" defaultValue={v(w.buyerShippingUsd)} className={inputCls} />
              </Field>
              <Field label="Expected resale" hint="Your estimate">
                <input name="resale" inputMode="decimal" defaultValue={v(w.expectedResaleUsd)} className={inputCls} />
              </Field>
              <Field label="Your target price">
                <input name="target" inputMode="decimal" defaultValue={v(w.targetPriceUsd)} className={inputCls} />
              </Field>
              <Field label="Listing link" className="col-span-2 sm:col-span-3">
                <input name="url" type="url" defaultValue={w.listingUrl ?? ""} className={inputCls} />
              </Field>
              <Field label="Note" className="col-span-2 sm:col-span-4">
                <input name="note" maxLength={500} defaultValue={w.note ?? ""} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-4">
              <Link href="/watchlist" className="text-sm text-muted hover:text-ink">Cancel</Link>
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}
