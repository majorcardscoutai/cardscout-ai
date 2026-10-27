import { offCentreInTitle } from "@/lib/ebay/parse";

/** Warning chip for off-centre ("OC") listings: the guide value may be too high. */
export function OffCentreWarning({ title }: { title: string }) {
  if (!offCentreInTitle(title)) return null;
  return (
    <span
      className="inline-flex items-center rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn"
      title="OC means off-centre. Off-centre cards usually sell for less than the guide price for their grade."
      data-testid="oc-warning"
    >
      ⚠ OC (off-centre) — value may not be accurate
    </span>
  );
}
