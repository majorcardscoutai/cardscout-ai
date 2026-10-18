import { Panel, Tag } from "@/components/ui";
import { certLookupUrl, compareCert, ebaySoldUrl, guideSearchUrl, PSA_AUCTION_PRICES_URL, type PsaCert } from "@/lib/sales";
import type { CardIdentity } from "@/lib/types";

export interface SlabCheck {
  cert: string | null;
  result: { ok: true; data: PsaCert } | { ok: false; error: string } | null;
}

const linkCls =
  "flex items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm hover:border-accent hover:text-accent";

/**
 * Recent sales (links to the real sales, never copied) + PSA slab check.
 * Shown on Analyse when a listing is loaded.
 */
export default function RecentSales({
  card,
  market,
  title,
  salesPerYear,
  slab,
}: {
  card: Partial<CardIdentity>;
  market: "EBAY_US" | "EBAY_AU";
  title: string;
  salesPerYear: number | null;
  slab: SlabCheck;
}) {
  const guide = guideSearchUrl(card);
  const lookup = slab.cert ? certLookupUrl(card.grader, slab.cert) : null;
  const cmp = slab.result?.ok ? compareCert(card, slab.result.data) : null;
  return (
    <Panel title="Recent sales & slab check" className="mb-6" right={salesPerYear !== null ? <Tag>Sells ~{salesPerYear}/yr</Tag> : undefined}>
      <p className="mb-3 text-xs text-muted">
        Check what this exact card has actually sold for before you buy. Each opens the source in a new tab, already searched for this card.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <a href={ebaySoldUrl(card, market, title)} target="_blank" rel="noopener noreferrer" className={linkCls}>
          <span><span className="font-medium">eBay sold listings</span><span className="block text-[11px] text-faint">Most recent first</span></span>↗
        </a>
        <a href={guide.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
          <span><span className="font-medium">{guide.label} sales history</span><span className="block text-[11px] text-faint">Sales by grade</span></span>↗
        </a>
        <a href={PSA_AUCTION_PRICES_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
          <span><span className="font-medium">PSA auction prices</span><span className="block text-[11px] text-faint">Search the card on PSA</span></span>↗
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Slab check</div>
        {!slab.cert ? (
          <p className="text-muted">
            {card.grader && card.grader !== "RAW"
              ? `The listing doesn't include the ${card.grader} certificate number — ask the seller for it, or read it off the slab photo${card.grader === "PSA" ? " and check it on psacard.com/cert" : ""}.`
              : "Not a graded card."}
          </p>
        ) : slab.result === null && card.grader !== "PSA" ? (
          <p className="text-muted">
            {card.grader ?? "Grader"} cert #{slab.cert}
            {lookup ? (
              <>
                {" "}·{" "}
                <a href={lookup} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">check it on {card.grader}&apos;s site ↗</a>
              </>
            ) : (
              ` — check it on ${card.grader ?? "the grader"}'s website.`
            )}{" "}
            <span className="text-xs text-faint">(Automatic checks are PSA only.)</span>
          </p>
        ) : slab.result === null ? (
          <p className="text-muted">
            Cert #{slab.cert}
            {lookup ? (
              <>
                {" "}·{" "}
                <a href={lookup} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">verify on {card.grader}&apos;s site ↗</a>
              </>
            ) : (
              ` — verify it on ${card.grader ?? "the grader"}'s website.`
            )}
          </p>
        ) : !slab.result.ok ? (
          <p className="text-muted">
            Cert #{slab.cert} — couldn&apos;t check it right now ({slab.result.error}){" "}
            {lookup && (
              <a href={lookup} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Verify on PSA ↗</a>
            )}
          </p>
        ) : (
          <div className="space-y-1">
            <p className={cmp?.matches ? "font-medium text-gain" : "font-medium text-loss"}>
              {cmp?.matches ? "✓ Matches PSA's record" : "⚠ PSA's record doesn't match the listing"} — cert #{slab.result.data.certNumber}
            </p>
            <p className="text-muted">
              {[slab.result.data.year, slab.result.data.brand, slab.result.data.subject, slab.result.data.cardNumber ? `#${slab.result.data.cardNumber}` : null, slab.result.data.variety]
                .filter(Boolean)
                .join(" · ")}{" "}
              · <span className="text-ink">{slab.result.data.grade ?? "grade not stated"}</span>
            </p>
            {cmp && !cmp.matches && (
              <ul className="space-y-0.5 text-xs text-loss">
                {cmp.issues.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            )}
            {slab.result.data.population !== null && (
              <p className="text-xs text-muted">
                PSA population: {slab.result.data.population.toLocaleString("en-US")} at this grade
                {slab.result.data.populationHigher !== null ? ` · ${slab.result.data.populationHigher.toLocaleString("en-US")} graded higher` : ""}
              </p>
            )}
            {cmp?.matches && (
              <p className="text-xs text-warn">
                A matching cert number doesn&apos;t prove the slab is genuine — fakes can copy real numbers. Check the slab photos (label,
                hologram, case) and buy from sellers with good feedback.
              </p>
            )}
            <p className="text-[11px] text-faint">
              Checked against PSA&apos;s certification database (PSA Public API). PSA doesn&apos;t guarantee items listed online.{" "}
              {lookup && (
                <a href={lookup} target="_blank" rel="noopener noreferrer" className="underline">See it on PSA ↗</a>
              )}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
