/** Attribution required by SportsCardsPro/PriceCharting wherever their prices are shown. */
export default function ProviderCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-faint ${className}`}>
      Market values from{" "}
      <a href="https://www.sportscardspro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
        SportsCardsPro
      </a>{" "}
      (sports) and{" "}
      <a href="https://www.pricecharting.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
        PriceCharting
      </a>{" "}
      (Pokémon), unless you&apos;ve set your own value.
    </p>
  );
}

/** Small label showing where a listing's value came from. */
export function ValueSource({ source }: { source?: string | null }) {
  if (!source) return null;
  if (source === "you") return <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">Your value</span>;
  const pc = source === "pricecharting";
  // Attribution: every price-guide value links to its source.
  return (
    <a
      href={pc ? "https://www.pricecharting.com" : "https://www.sportscardspro.com"}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent hover:underline"
    >
      {pc ? "PriceCharting value" : "SportsCardsPro value"}
    </a>
  );
}

/** Why a listing has no automatic value — short label + tap "why?" for the detail. */
export function NoValueReason({ row, hasKey, configured, pending = false }: {
  row?: { status: string; detail: string | null } | null;
  hasKey: boolean;
  configured: boolean;
  pending?: boolean;
}) {
  if (!hasKey)
    return <span title="The listing doesn't state every detail needed to match exactly (year, set, number, parallel, grade)">Card details unclear — use Analyse</span>;
  if (!configured) return <span>No value saved for this card</span>;
  if (!row) return <span>{pending ? "Looking up value…" : "No value yet"}</span>;
  const label =
    row.status === "no_price" ? "Price guide has no price for this grade"
    : row.status === "ambiguous" ? "Several possible matches in the guide"
    : row.status === "rejected" ? "You marked the guide match as wrong"
    : "No exact price-guide match";
  return (
    <details className="inline-block">
      <summary className="cursor-pointer list-none">
        {label} · <span className="underline">why?</span>
      </summary>
      <span className="mt-1 block max-w-md whitespace-normal text-muted">{row.detail ?? "No more detail."} You can set your own value instead.</span>
    </details>
  );
}
