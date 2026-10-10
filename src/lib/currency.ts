/** Currency helpers. Values are stored in USD and converted for display. */

export function usdToAud(usd: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate must be a positive number");
  }
  return usd * rate;
}

export function audToUsd(aud: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate must be a positive number");
  }
  return aud / rate;
}

/** Round to cents, avoiding floating-point artefacts like 0.1 + 0.2. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumber(value: number, decimals: number): string {
  return Math.abs(value).toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** "US$1,234" style formatting. Whole dollars unless the value is small. */
export function formatMoney(value: number, currency: "USD" | "AUD"): string {
  const prefix = currency === "USD" ? "US$" : "A$";
  const decimals = Math.abs(value) < 100 ? 2 : 0;
  const sign = value < 0 ? "-" : "";
  return `${sign}${prefix}${formatNumber(value, decimals)}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
