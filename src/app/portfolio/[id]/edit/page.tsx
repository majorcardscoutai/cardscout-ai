import Link from "next/link";
import { notFound } from "next/navigation";
import { updateHoldingAction } from "@/app/actions";
import { CardFields, CurrencyPicker, DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { IconArrowLeft } from "@/components/Icons";
import { PageHeader, Panel } from "@/components/ui";
import { getHolding } from "@/data/db";

export const dynamic = "force-dynamic";

const v = (n: number | null) => (n === null ? "" : String(n));

export default async function EditHoldingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { data: h, error: dbError } = await getHolding(id);
  if (!h && !dbError) notFound();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/portfolio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconArrowLeft className="h-4 w-4" /> Portfolio
      </Link>
      <PageHeader title="Edit holding" subtitle="Prices are shown in US$, the currency they're stored in. You can switch to A$ before saving." />
      <Flash error={error} />
      <DbError error={dbError} />

      {h && (
        <Panel>
          <form action={updateHoldingAction} className="space-y-5">
            <input type="hidden" name="id" value={h.id} />
            <CardFields card={h.card} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CurrencyPicker defaultValue="USD" />
              <Field label="Purchase price">
                <input name="purchasePrice" required inputMode="decimal" defaultValue={v(h.purchasePriceUsd)} className={inputCls} />
              </Field>
              <Field label="Extra costs">
                <input name="purchaseCosts" inputMode="decimal" defaultValue={v(h.purchaseCostsUsd)} className={inputCls} />
              </Field>
              <Field label="Date bought">
                <input name="purchasedAt" type="date" defaultValue={h.purchasedAt.slice(0, 10)} max={today} className={inputCls} />
              </Field>
              <Field label="Your current value estimate" className="col-span-2">
                <input name="estimatedValue" inputMode="decimal" defaultValue={v(h.estimatedValueUsd)} className={inputCls} />
              </Field>
              <Field label="Note" className="col-span-2">
                <input name="note" maxLength={500} defaultValue={h.note ?? ""} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-4">
              <Link href="/portfolio" className="text-sm text-muted hover:text-ink">Cancel</Link>
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}
