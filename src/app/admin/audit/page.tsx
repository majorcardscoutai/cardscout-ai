import Link from "next/link";
import { notFound } from "next/navigation";
import { auditDealAction } from "@/app/actions";
import { DbError, Flash } from "@/components/FormBits";
import { Money, PageHeader, Panel, Pct, Tag } from "@/components/ui";
import { DealScore } from "@/components/DealScore";
import { EbayLink } from "@/components/EbayLink";
import { listAudits, wrongMatchCounts } from "@/data/audit";
import { currentDeals, sortDeals } from "@/data/deals";
import { currentViewer } from "@/data/session";
import { AUDIT_REASONS, topReasons, weeklyPrecision } from "@/lib/audit";
import { displayFx } from "@/lib/region";

export const metadata = { title: "CardHawk AI · Accuracy audit" };
export const dynamic = "force-dynamic";

const TARGET = 90;

/**
 * Admin only. Check CardHawk's deals by hand (against SportsCardsPro and the eBay listing) and record whether each
 * was real. The weekly precision is THE number to watch before charging people: target 90%+.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const viewer = await currentViewer();
  if (!viewer?.admin) notFound();
  const { saved, error } = await searchParams;
  const [live, audits, wrong] = await Promise.all([currentDeals(), listAudits(), wrongMatchCounts(7)]);
  const fx = displayFx(live.settings);
  const done = new Map(audits.data.map((a) => [a.itemId, a]));
  const queue = [...sortDeals(live.deals, "profit"), ...sortDeals(live.needsCheck, "profit")];
  const todo = queue.filter((d) => !done.has(d.itemId));
  const weeks = weeklyPrecision(audits.data);
  const reasons = topReasons(audits.data);
  const thisWeek = weeks[0];

  return (
    <>
      <PageHeader title="Accuracy audit" subtitle="Were CardHawk's deals real? Check each against SportsCardsPro and the listing, then mark it. Admins only." />
      <Flash saved={saved} error={error} />
      <DbError error={audits.error && !/deal_audits/.test(audits.error) ? audits.error : null} />
      {audits.error && /deal_audits/.test(audits.error) && (
        <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          One-time setup: run the “30 Oct 2026: deal accuracy audit” SQL from the bottom of <code>supabase/schema.sql</code> in Supabase.
        </p>
      )}
      <Link href="/admin" className="text-xs text-accent hover:underline">← Admin</Link>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs text-faint">Precision this week</div>
          <div className={`num mt-1 text-3xl font-semibold ${thisWeek?.precision == null ? "text-muted" : thisWeek.precision >= TARGET ? "text-gain" : "text-loss"}`} data-testid="precision">
            {thisWeek?.precision == null ? "—" : `${thisWeek.precision}%`}
          </div>
          <div className="mt-1 text-xs text-faint">
            {thisWeek ? `${thisWeek.good} real · ${thisWeek.bad} wrong · ${thisWeek.unsure} unsure` : "Nothing checked yet"} · target {TARGET}%+
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs text-faint">“Wrong match?” taps, last 7 days</div>
          <div className="num mt-1 text-3xl font-semibold">{wrong.lastDays ?? "—"}</div>
          <div className="mt-1 text-xs text-faint">by members · {wrong.sharedRejected ?? "—"} values rejected for everyone (by admins)</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs text-faint">Left to check</div>
          <div className="num mt-1 text-3xl font-semibold">{todo.length}</div>
          <div className="mt-1 text-xs text-faint">of {queue.length} live deals (incl. {live.needsCheck.length} held for a manual check)</div>
        </div>
      </div>

      <Panel title="Check these" className="mt-6" right={<Tag>{todo.length}</Tag>}>
        {todo.length === 0 ? (
          <p className="text-sm text-muted">All current deals are checked. New ones appear here as scans find them.</p>
        ) : (
          <ul className="divide-y divide-line">
            {todo.slice(0, 30).map((d) => (
              <li key={d.id} className="flex flex-col gap-3 py-4 first:pt-0 lg:flex-row lg:items-center" data-testid="audit-row">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{d.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                    <EbayLink url={d.url} />
                    {d.needsCheck && <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-warn">held: {d.needsCheck}</span>}
                    <span>{d.valueTitle ?? d.cardKey ?? ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><div className="text-[10px] text-faint">PRICE</div><Money usd={d.priceUsd} fx={fx} size="sm" align="right" /></div>
                  <div className="text-right"><div className="text-[10px] text-faint">VALUE</div><Money usd={d.valueUsd} fx={fx} size="sm" align="right" /></div>
                  <div className="text-right"><div className="text-[10px] text-faint">ROI</div><Pct value={d.roiPercent} /></div>
                  <DealScore score={d.score} />
                </div>
                <form action={auditDealAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="itemId" value={d.itemId} />
                  <button name="verdict" value="good" className="rounded-lg bg-gain-soft px-3 py-1.5 text-xs font-medium text-gain ring-1 ring-gain/40">✓ Real deal</button>
                  <select name="reason" defaultValue="" className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs" aria-label="Why it's wrong">
                    <option value="" disabled>Why wrong?</option>
                    {AUDIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button name="verdict" value="bad" className="rounded-lg bg-loss-soft px-3 py-1.5 text-xs font-medium text-loss ring-1 ring-loss/40">✗ Wrong</button>
                  <button name="verdict" value="unsure" className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink">Unsure</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Weekly precision">
          {weeks.length === 0 ? (
            <p className="text-sm text-muted">No checks yet. Aim for 50 a week — about 15 minutes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="py-1 font-normal">Week of</th><th className="font-normal">Real</th><th className="font-normal">Wrong</th><th className="font-normal">Unsure</th><th className="text-right font-normal">Precision</th></tr></thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week} className="border-t border-line">
                    <td className="py-2">{new Date(w.week).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</td>
                    <td className="num">{w.good}</td><td className="num">{w.bad}</td><td className="num">{w.unsure}</td>
                    <td className={`num text-right ${w.precision == null ? "text-muted" : w.precision >= TARGET ? "text-gain" : "text-loss"}`}>{w.precision == null ? "—" : `${w.precision}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Why deals were wrong">
          {reasons.length === 0 ? (
            <p className="text-sm text-muted">Nothing marked wrong yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reasons.map(([r, n]) => (
                <li key={r} className="flex justify-between"><span>{r}</span><span className="num text-muted">{n}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-faint">The top reason is the next matching rule to fix — send me a few examples.</p>
        </Panel>
      </div>
    </>
  );
}
