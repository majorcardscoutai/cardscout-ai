/** The value shown is the guide's grade price for any grading company (mostly PSA sales) — usually too high for BGS/CGC/SGC. */
export function GradePriceWarning({ label }: { label: string | null | undefined }) {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn"
      title={`The price guide has one price for this grade across all grading companies, mostly from PSA sales. ${label} usually sells for less, so the value and profit shown are likely too high. Never counted as a deal.`}
      data-testid="grade-price-warning"
    >
      ⚠ {label}: guide price is for any company — likely too high
    </span>
  );
}
