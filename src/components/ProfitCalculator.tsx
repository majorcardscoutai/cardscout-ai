"use client";

import { useState } from "react";
import { calculateProfit, maxPurchasePrice, recommendedOpeningOffer } from "@/lib/profit";
import type { Settings } from "@/lib/types";
import { Money, Pct } from "./ui";

/**
 * Live profit calculator. Uses the same tested engine as the deal pages.
 * You type the expected resale yourself here — in Phase 3 it will be filled
 * from verified sold comparisons.
 */
export default function ProfitCalculator({ defaults }: { defaults: Settings }) {
  const [currency, setCurrency] = useState<"USD" | "AUD">("USD");
  const [fxStr, setFxStr] = useState(String(defaults.usdToAud));
  const fx = Number(fxStr);
  const [asking, setAsking] = useState("250");
  const [shipping, setShipping] = useState("18");
  const [resale, setResale] = useState("380");
  const [feeRate, setFeeRate] = useState(String(defaults.marketplaceFeeRate * 100));
  const [importTax, setImportTax] = useState(String(defaults.importTaxRate * 100));
  const [minRoi, setMinRoi] = useState(String(defaults.minRoiPercent));
  const [minProfit, setMinProfit] = useState(String(defaults.minProfitUsd));

  // Inputs typed in AUD are converted to USD for the engine.
  const toUsd = (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return currency === "AUD" ? n / fx : n;
  };

  const settings: Settings = {
    ...defaults,
    usdToAud: fx,
    marketplaceFeeRate: Number(feeRate) / 100,
    importTaxRate: Number(importTax) / 100,
    minRoiPercent: Number(minRoi),
    minProfitUsd: Number(minProfit),
  };

  const askingUsd = toUsd(asking);
  const shippingUsd = toUsd(shipping);
  const resaleUsd = toUsd(resale);
  const valid =
    [askingUsd, shippingUsd, resaleUsd, fx, settings.marketplaceFeeRate, settings.importTaxRate].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) && Number.isFinite(fx) && fx > 0;

  let result = null;
  let maxPrice: number | null = null;
  let offer: number | null = null;
  if (valid) {
    result = calculateProfit({
      purchasePriceUsd: askingUsd,
      buyerShippingUsd: shippingUsd,
      expectedResaleUsd: resaleUsd,
      settings,
    });
    maxPrice = maxPurchasePrice(resaleUsd, shippingUsd, settings);
    offer = recommendedOpeningOffer(askingUsd, maxPrice);
  }
  const passes =
    result !== null &&
    result.roiPercent >= settings.minRoiPercent &&
    result.netProfitUsd >= settings.minProfitUsd;

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    suffix?: string,
  ) => (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-line bg-panel-2 focus-within:border-accent">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="num w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
        {suffix && <span className="pr-3 text-xs text-faint">{suffix}</span>}
      </div>
    </label>
  );

  const cur = currency === "USD" ? "US$" : "A$";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex gap-1 rounded-lg bg-panel-2 p-1 ring-1 ring-line">
          {(["USD", "AUD"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${currency === c ? "bg-ink text-bg" : "text-muted"}`}
            >
              Enter prices in {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Asking / purchase price", asking, setAsking, cur)}
          {field("Shipping to you", shipping, setShipping, cur)}
          {field("Expected resale (sold comps)", resale, setResale, cur)}
          {field("USD → AUD rate", fxStr, setFxStr)}
          {field("Marketplace fee", feeRate, setFeeRate, "%")}
          {field("Import GST", importTax, setImportTax, "%")}
          {field("Minimum ROI", minRoi, setMinRoi, "%")}
          {field("Minimum profit", minProfit, setMinProfit, "US$")}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          Also included from Settings: fixed fee US${defaults.marketplaceFixedFeeUsd}, shipping to buyer US$
          {defaults.outboundShippingUsd}, other costs US${defaults.otherCostsUsd}.
        </p>
      </div>

      <div className="lg:col-span-3">
        {!valid || !result ? (
          <div className="rounded-xl border border-dashed border-loss/40 p-6 text-sm text-loss">
            Enter valid, non-negative numbers to see results.
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-panel-2 p-5">
            <div
              className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                passes ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"
              }`}
            >
              {passes ? "Meets your ROI and profit rules" : "Does not meet your rules"}
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
            {maxPrice === null && (
              <p className="mt-4 text-sm text-loss">
                At this resale value, no purchase price meets your minimum ROI and profit.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
