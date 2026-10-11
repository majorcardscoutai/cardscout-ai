"use client";

import { useState } from "react";
import { addWatchlistAction } from "@/app/actions";
import { calculateProfit, maxPurchasePrice, recommendedOpeningOffer } from "@/lib/profit";
import type { CardIdentity, Settings } from "@/lib/types";
import { CardFields, CurrencyPicker, Field, inputCls, SubmitButton } from "./FormBits";
import { Money, Pct } from "./ui";

/**
 * Manual Scanner form: card details + prices → live profit check → save.
 * "Expected resale" is YOUR estimate for now. In Phase 3 it will be filled
 * from verified sold data instead.
 */
export interface ManualPrefill {
  card?: Partial<CardIdentity>;
  askingUsd?: number | null;
  shippingUsd?: number | null;
  url?: string;
  note?: string;
}

export default function ManualAnalysis({ settings, prefill }: { settings: Settings; prefill?: ManualPrefill }) {
  const fx = settings.usdToAud;
  const fromListing = prefill?.askingUsd !== undefined && prefill?.askingUsd !== null;
  const [currency, setCurrency] = useState<"USD" | "AUD">(fromListing ? "USD" : "AUD");
  const [asking, setAsking] = useState(fromListing ? String(prefill?.askingUsd) : "");
  const [shipping, setShipping] = useState(
    prefill?.shippingUsd !== undefined && prefill?.shippingUsd !== null ? String(prefill.shippingUsd) : "",
  );
  const [resale, setResale] = useState("");

  const toUsd = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v.replace(/[,\s$]/g, ""));
    if (!Number.isFinite(n) || n < 0) return NaN;
    return currency === "AUD" ? n / fx : n;
  };

  const askingUsd = toUsd(asking);
  const shippingUsd = toUsd(shipping) ?? 0;
  const resaleUsd = toUsd(resale);
  const invalid = [askingUsd, shippingUsd, resaleUsd].some((n) => n !== null && Number.isNaN(n));
  const ready = !invalid && askingUsd !== null && resaleUsd !== null;

  const result = ready
    ? calculateProfit({
        purchasePriceUsd: askingUsd as number,
        buyerShippingUsd: shippingUsd,
        expectedResaleUsd: resaleUsd as number,
        settings,
      })
    : null;
  const maxPrice = ready ? maxPurchasePrice(resaleUsd as number, shippingUsd, settings) : null;
  const offer = ready ? recommendedOpeningOffer(askingUsd as number, maxPrice) : null;
  const passes =
    result !== null && result.roiPercent >= settings.minRoiPercent && result.netProfitUsd >= settings.minProfitUsd;
  const sym = currency === "AUD" ? "A$" : "US$";

  return (
    <form action={addWatchlistAction} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium">1. Identify the card</h3>
        <CardFields card={prefill?.card} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium">2. Prices</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CurrencyPicker value={currency} onChange={setCurrency} />
          <Field label={`Asking price (${sym})`}>
            <input name="asking" required inputMode="decimal" value={asking} onChange={(e) => setAsking(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Shipping to you (${sym})`}>
            <input name="shipping" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Expected resale (${sym})`} hint="Your estimate from recent sold listings">
            <input name="resale" inputMode="decimal" value={resale} onChange={(e) => setResale(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Your target price (${sym})`} hint="Optional">
            <input name="target" inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Listing link" hint="Optional" className="col-span-2 sm:col-span-3">
            <input name="url" type="url" defaultValue={prefill?.url ?? ""} placeholder="https://www.ebay.com.au/itm/…" className={inputCls} />
          </Field>
          <Field label="Note" className="col-span-2 sm:col-span-4">
            <input name="note" maxLength={500} defaultValue={prefill?.note ?? ""} placeholder="e.g. check centering on slab photo" className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel-2 p-5">
        <h3 className="mb-1 text-sm font-medium">3. Result</h3>
        <p className="mb-4 text-xs text-warn">
          Based on your own resale estimate — not verified sold data. Investment scores need verified sales (Phase 3).
        </p>
        {invalid ? (
          <p className="text-sm text-loss">Prices must be positive numbers.</p>
        ) : !result ? (
          <p className="text-sm text-muted">Enter an asking price and expected resale to see profit and ROI.</p>
        ) : (
          <>
            <div
              className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                passes ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"
              }`}
            >
              {passes
                ? `Meets your rules (≥ ${settings.minRoiPercent}% ROI and ≥ US$${settings.minProfitUsd} profit)`
                : "Does not meet your ROI and profit rules"}
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted">Net profit</div>
                <Money usd={result.netProfitUsd} fx={fx} tone="auto" size="lg" />
              </div>
              <div>
                <div className="text-xs text-muted">ROI</div>
                <div className="mt-1 text-2xl"><Pct value={result.roiPercent} /></div>
              </div>
              <div>
                <div className="text-xs text-muted">Total acquisition cost</div>
                <Money usd={result.totalAcquisitionCostUsd} fx={fx} size="lg" />
              </div>
              <div>
                <div className="text-xs text-muted">Marketplace fees</div>
                <Money usd={result.marketplaceFeesUsd} fx={fx} />
              </div>
              <div>
                <div className="text-xs text-muted">Max profitable price</div>
                <Money usd={maxPrice} fx={fx} />
              </div>
              <div>
                <div className="text-xs text-muted">Opening offer (rule of thumb)</div>
                <Money usd={offer} fx={fx} />
              </div>
            </div>
            <p className="mt-4 text-xs text-faint">
              Includes import GST {settings.importTaxRate * 100}%, fees {(settings.marketplaceFeeRate * 100).toFixed(2)}% + US$
              {settings.marketplaceFixedFeeUsd}, shipping to buyer US${settings.outboundShippingUsd}, other costs US$
              {settings.otherCostsUsd}. Change these in Settings.
            </p>
          </>
        )}
      </section>

      <div className="flex justify-end">
        <SubmitButton>Save to watchlist</SubmitButton>
      </div>
    </form>
  );
}
