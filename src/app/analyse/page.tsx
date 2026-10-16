import { loadListingAction } from "@/app/actions";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { IconAlert } from "@/components/Icons";
import ManualAnalysis, { type ManualPrefill } from "@/components/ManualAnalysis";
import { Money, PageHeader, Panel, Tag } from "@/components/ui";
import { cardValueMap, listProviderValues } from "@/data/db";
import { lookupCard, needsLookup, providerName } from "@/data/provider";
import { providerConfigured } from "@/lib/provider-client";
import type { CardIdentity, Settings } from "@/lib/types";
import { loadSettings } from "@/data/source";
import { cardKey } from "@/lib/cardKey";
import { ebayConfigured, getListing, toUsd, type EbayListing, type Marketplace } from "@/lib/ebay/client";
import { cardFromListing, type CardSuggestion } from "@/lib/ebay/parse";
import { displayFx, isImport, shipToCountry, shipToFor, taxLabel } from "@/lib/region";

export const dynamic = "force-dynamic";

function riskFlags(l: EbayListing, settings: Settings): string[] {
  const flags: string[] = [];
  if (l.sellerFeedbackScore !== null && l.sellerFeedbackScore < 50) flags.push("Seller has fewer than 50 feedback ratings");
  if (l.sellerFeedbackPercent !== null && l.sellerFeedbackPercent < 98.5) flags.push("Seller positive feedback below 98.5%");
  if (l.returnsAccepted === false) flags.push("Returns not accepted");
  if (l.isAuction) flags.push("Auction — the price shown is the current bid and will likely rise");
  if (isImport(l.country, settings)) flags.push(`Ships from ${l.country} — ${taxLabel(settings.buyerRegion).toLowerCase()} may apply`);
  return flags;
}

export default async function ManualScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; item?: string; market?: string }>;
}) {
  const { saved, error, item, market } = await searchParams;
  const { settings, error: dbError } = await loadSettings();
  const fx = settings.usdToAud; // for converting eBay AU prices
  const showFx = displayFx(settings); // A$ shown for Australian buyers only
  const shipCountry = shipToCountry(settings);
  const connected = ebayConfigured();

  let listing: EbayListing | null = null;
  let listingError: string | null = null;
  let suggestion: CardSuggestion | null = null;
  let prefill: ManualPrefill | undefined;
  let providerNote: string | null = null;

  if (item) {
    const mkt: Marketplace = market === "EBAY_AU" ? "EBAY_AU" : "EBAY_US";
    const r = await getListing(item, mkt, shipToFor(settings));
    if (r.ok) {
      listing = r.data;
      suggestion = cardFromListing(listing.title, listing.aspects);
      const key = cardKey(suggestion.card);
      let known = key ? (await cardValueMap()).map.get(key) : undefined;
      // No value yet → ask the price guide now (1–2 lookups), then it's cached for scans too.
      if (key && !known && providerConfigured()) {
        const cached = (await listProviderValues()).data.find((r) => r.key === key);
        if (needsLookup(cached)) {
          const r = await lookupCard(suggestion.card as CardIdentity, key);
          if (r.row.status === "matched" && r.row.valueUsd !== null)
            known = { id: `auto:${key}`, key, title: r.row.matchedName ?? "", valueUsd: r.row.valueUsd, updatedAt: new Date().toISOString(), source: r.row.site, matchedName: r.row.matchedName ?? undefined, graderSpecific: r.row.graderSpecific };
          else providerNote = r.error ?? r.row.detail ?? null;
        } else if (cached && cached.status !== "matched") providerNote = cached.status === "rejected" ? "You marked the price-guide match for this card as wrong." : cached.detail;
      }
      const askingUsd = toUsd(listing.price, fx);
      if (listing.price && askingUsd === null) {
        listingError = `This listing is priced in ${listing.price.currency}. Only US$ and A$ listings are supported for now.`;
      }
      prefill = {
        card: suggestion.card,
        askingUsd,
        shippingUsd: settings.inboundShippingMode === "fixed" ? settings.inboundShippingFixedUsd : toUsd(listing.shipping, fx),
        url: listing.url,
        resaleUsd: known?.valueUsd ?? null,
        resaleSource: known
          ? known.source && known.source !== "you"
            ? `${providerName(known.source)} value: ${known.matchedName ?? known.title}${known.graderSpecific === false ? " (grade price for any grading company)" : ""} — check it's the same card`
            : `Your value for this card (saved ${new Date(known.updatedAt).toLocaleDateString("en-AU")})`
          : providerNote
            ? `No automatic value: ${providerNote}`
            : undefined,
        note: listing.isAuction ? `Auction · current bid${listing.bidCount !== null ? ` · ${listing.bidCount} bids` : ""}` : "",
      };
    } else {
      listingError = r.error;
    }
  }

  return (
    <>
      <PageHeader
        title="Manual Scanner"
        subtitle="Paste an eBay link or enter a card's exact details, check the profit, then save it to your watchlist."
      />
      <Flash saved={saved} error={error} />
      <DbError error={dbError} />

      <Panel title="Paste an eBay listing link" className="mb-6" right={<Tag tone={connected ? "default" : "warn"}>{connected ? "eBay connected" : "eBay not connected yet"}</Tag>}>
        <form action={loadListingAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Listing link or item number" className="flex-1">
            <input name="listingUrl" required placeholder="https://www.ebay.com.au/itm/…" className={inputCls} />
          </Field>
          <SubmitButton tone="neutral">Load listing</SubmitButton>
        </form>
        {!connected && (
          <p className="mt-2 text-xs text-faint">
            Waiting for your eBay developer keys. Until then, enter the card details by hand below.
          </p>
        )}
      </Panel>

      {listingError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{listingError}</span>
        </div>
      )}

      {listing && suggestion && (
        <Panel title="Listing loaded from eBay" className="mb-6" right={<Tag>Asking price — not market value</Tag>}>
          <div className="flex flex-col gap-4 sm:flex-row">
            {listing.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.imageUrl} alt="" className="h-40 w-28 shrink-0 rounded-md object-cover ring-1 ring-line" />
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <a href={listing.url} target="_blank" rel="noopener noreferrer" className="block font-medium hover:text-accent">
                {listing.title} ↗
              </a>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-muted">{listing.isAuction ? "Current bid" : "Asking price"}</div>
                  <Money usd={toUsd(listing.price, fx)} fx={showFx} />
                </div>
                <div>
                  <div className="text-xs text-muted">
                    {settings.inboundShippingMode === "fixed" ? "Shipping (parcel locker)" : `Shipping to ${shipCountry}`}
                  </div>
                  {settings.inboundShippingMode === "fixed" ? (
                    <>
                      <Money usd={settings.inboundShippingFixedUsd} fx={showFx} />
                      <div className="text-[11px] text-faint">Your setting · eBay quotes {listing.shipping ? `${listing.shipping.currency} ${listing.shipping.value}` : "n/a"} to {shipCountry}</div>
                    </>
                  ) : listing.shipping ? (
                    <Money usd={toUsd(listing.shipping, fx)} fx={showFx} />
                  ) : (
                    <span className="text-sm text-faint">Not stated — check listing</span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted">Seller</div>
                  <div className="num text-sm">
                    {listing.sellerFeedbackScore ?? "?"} · {listing.sellerFeedbackPercent ?? "?"}%
                  </div>
                </div>
              </div>
              {suggestion.missing.length > 0 ? (
                <p className="text-sm text-warn">
                  Couldn&apos;t work out: <strong>{suggestion.missing.join(", ")}</strong>. Fill these in below.
                </p>
              ) : (
                <p className="text-sm text-muted">Card details filled in from the listing — check them, especially parallel and grade.</p>
              )}
              {riskFlags(listing, settings).length > 0 && (
                <ul className="space-y-1 text-xs text-loss">
                  {riskFlags(listing, settings).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Analyse a card" className="mb-6" right={<Tag>{listing ? "Prefilled from eBay" : "Manual entry"}</Tag>}>
        <ManualAnalysis key={item ?? "manual"} settings={settings} prefill={prefill} />
      </Panel>

      <Panel title="Upload a card photo" right={<Tag tone="warn">Phase 5</Tag>}>
        <p className="text-xs leading-relaxed text-faint">
          AI image analysis will suggest the card identity for you to confirm. It never replaces checking the set,
          number and parallel yourself.
        </p>
      </Panel>
    </>
  );
}
