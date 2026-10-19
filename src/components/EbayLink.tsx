/** "View on eBay ↗" — makes it clear every purchase happens on eBay, not in CardHawk. */
export function EbayLink({ url, size = "sm" }: { url: string; size?: "sm" | "md" }) {
  const cls =
    size === "md"
      ? "inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent/90"
      : "inline-flex items-center rounded-md px-1.5 py-0.5 font-medium text-accent ring-1 ring-accent/40 hover:bg-accent/10";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls} data-testid="ebay-link">
      View on eBay ↗
    </a>
  );
}
