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
  const label = source === "you" ? "Your value" : source === "pricecharting" ? "PriceCharting value" : "SportsCardsPro value";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${source === "you" ? "bg-panel-2 text-muted" : "bg-accent/10 text-accent"}`}>{label}</span>
  );
}
