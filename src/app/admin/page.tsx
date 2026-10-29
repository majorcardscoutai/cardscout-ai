import { notFound } from "next/navigation";
import { inviteAction } from "@/app/actions";
import { DbError, Field, Flash, inputCls, SubmitButton } from "@/components/FormBits";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { listAccounts, listUsage, listWaitlist } from "@/data/db";
import { currentViewer } from "@/data/session";
import { systemHealth } from "@/data/health";
import { affiliateCampaignId, ebayConfigured, fixedPriceOnly } from "@/lib/ebay/client";
import { emailConfigured } from "@/lib/email";
import { WAITLIST_GOALS } from "@/lib/forms";
import { MAX_SAVED_SEARCHES } from "@/lib/limits";
import { providerConfigured } from "@/lib/provider-client";
import { psaConfigured } from "@/lib/psa";
import { userDbConfigured } from "@/lib/supabase";
import { legalDetails } from "@/lib/legal";

export const metadata = { title: "CardHawk AI · Admin" };
export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—");

/** Admin only (ADMIN_EMAILS): accounts, invites, waitlist, API usage and service status. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const viewer = await currentViewer();
  if (!viewer?.admin) notFound();
  const { saved, error } = await searchParams;
  const [accounts, waitlist, usage, health] = await Promise.all([listAccounts(), listWaitlist(), listUsage(7), systemHealth()]);

  const emailOf = new Map(accounts.data.map((a) => [a.userId, a.email]));
  const scopeLabel = (s: string) => (s === "shared" ? "Shared Hunter search" : s === "app" ? "Pages (Analyse, live search)" : (emailOf.get(s) ?? `Account ${s.slice(0, 8)}`));
  const days = [...new Set(usage.data.map((u) => u.day))].sort().reverse();
  const accountEmails = new Set(accounts.data.map((a) => a.email.toLowerCase()));
  const status: [string, boolean, string][] = [
    ["eBay", ebayConfigured(), "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET"],
    ["SportsCardsPro / PriceCharting", providerConfigured(), "SPORTSCARDSPRO_TOKEN"],
    ["PSA slab checks", psaConfigured(), "PSA_API_TOKEN (waiting on PSA approval)"],
    ["Alert emails (Resend)", emailConfigured(), "RESEND_API_KEY"],
    ["Database protection", userDbConfigured(), "SUPABASE_PUBLISHABLE_KEY"],
    ["Terms & Privacy details", legalDetails().missing.length === 0, legalDetails().missing.join(" + ")],
    ["eBay Partner Network (commission on eBay links)", affiliateCampaignId() !== null, "EBAY_CAMPAIGN_ID (10-digit Campaign ID)"],
    ["eBay: fixed-price listings only (Buy API requirement)", fixedPriceOnly(), "EBAY_FIXED_PRICE_ONLY=1 when you're ready"],
    ["Outside health monitor", !!process.env.HEALTH_KEY, "HEALTH_KEY, then point UptimeRobot at /api/cron/health?key=…"],
  ];

  return (
    <>
      <PageHeader title="Admin" subtitle="Accounts, invites, waitlist and API usage. Only admins can see this page." />
      <Flash saved={saved} error={error} />
      <DbError error={accounts.error && !/profiles/.test(accounts.error) ? accounts.error : null} />

      <Panel
        title="Scanning health"
        className="mt-6"
        right={<span data-testid="health-status" className={`text-xs font-medium ${health.ok ? "text-gain" : "text-loss"}`}>{health.ok ? "● All running" : "● Needs attention"}</span>}
      >
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-faint">Profit Hunter last ran</div>
            <div className="num">{health.hunterAgeMin === null ? "never" : `${health.hunterAgeMin} min ago`}</div>
          </div>
          <div>
            <div className="text-xs text-faint">Saved-search scan last ran</div>
            <div className="num">{health.scanAgeMin === null ? "never" : health.scanAgeMin < 120 ? `${health.scanAgeMin} min ago` : `${Math.round(health.scanAgeMin / 60)} h ago`}</div>
          </div>
        </div>
        {health.problems.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md bg-loss-soft px-3 py-2 text-xs text-loss">
            {health.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </Panel>

      <a href="/admin/audit" className="mt-6 flex items-center justify-between rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent hover:bg-accent/15">
        <span><strong>Accuracy audit</strong> — check this week&apos;s deals by hand and track how many were real (target 90%+).</span>
        <span aria-hidden>→</span>
      </a>

      <Panel title="Invite someone" className="mt-6">
        <form action={inviteAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Email" className="flex-1" hint="They get an email with a link to choose a password, then they're in.">
            <input type="email" name="email" required maxLength={254} placeholder="collector@example.com" className={inputCls} />
          </Field>
          <SubmitButton>Send invite</SubmitButton>
        </form>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Before inviting beta users: wait for eBay&apos;s written OK, and set Resend as Supabase&apos;s email sender (Authentication → Emails →
          SMTP) on your own domain — Supabase&apos;s built-in email only reaches your own team, a few per hour. Each account gets {MAX_SAVED_SEARCHES}{" "}
          saved searches.
        </p>
      </Panel>

      <Panel title="Accounts" className="mt-6" right={<Tag>{accounts.data.length}</Tag>}>
        {accounts.error && /profiles/.test(accounts.error) ? (
          <p className="text-xs text-warn">Run the Phase 6 step 4 SQL in Supabase to list accounts.</p>
        ) : accounts.data.length === 0 ? (
          <p className="text-sm text-faint">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Joined</th>
                  <th className="py-2 pr-3 font-medium">Last seen</th>
                  <th className="py-2 pr-3 font-medium">Saved searches</th>
                  <th className="py-2 font-medium">Hunter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accounts.data.map((a) => (
                  <tr key={a.userId}>
                    <td className="py-2 pr-3">{a.email}</td>
                    <td className="py-2 pr-3 text-muted">{day(a.createdAt)}</td>
                    <td className="py-2 pr-3 text-muted">{day(a.lastSeenAt)}</td>
                    <td className="py-2 pr-3 text-muted">{a.savedSearches}</td>
                    <td className="py-2 text-muted">{a.hunterOn ? "On" : "Off"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Waitlist" className="mt-6" right={<Tag>{waitlist.data.length} sign-up{waitlist.data.length === 1 ? "" : "s"}</Tag>}>
        <p className="mb-3 text-sm text-muted">
          People who joined from the sign-in page.{" "}
          {waitlist.data.length > 0 && (
            <span className="text-faint">
              Goals: {WAITLIST_GOALS.map(([k, label]) => `${label} ${waitlist.data.filter((w) => w.goals.includes(k)).length}`).join(" · ")}.{" "}
            </span>
          )}
          {waitlist.data.length > 0 && (
            <a href="/api/waitlist" className="text-accent hover:underline">
              Download CSV
            </a>
          )}
        </p>
        {waitlist.error && /waitlist/.test(waitlist.error) ? (
          <p className="text-xs text-warn">Run the waitlist SQL in Supabase to switch this on (see PROGRESS.md).</p>
        ) : waitlist.error ? (
          <p className="text-xs text-loss">{waitlist.error}</p>
        ) : waitlist.data.length === 0 ? (
          <p className="text-sm text-faint">No sign-ups yet. Share your sign-in page link (e.g. in your Instagram bio).</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {waitlist.data.slice(0, 100).map((w) => (
              <li key={w.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{w.email}</span>
                  <span className="block text-xs text-faint">
                    {w.region ? `${w.region === "OTHER" ? "Rest of world" : w.region} · ` : ""}
                    {w.goals.length ? `${w.goals.map((g) => WAITLIST_GOALS.find(([k]) => k === g)?.[1] ?? g).join(", ")} · ` : ""}
                    {w.interests.length ? `${w.interests.map((i) => (i === "Pokemon" ? "Pokémon" : i)).join(", ")} · ` : ""}
                    joined {day(w.createdAt)}
                  </span>
                </span>
                {accountEmails.has(w.email.toLowerCase()) ? (
                  <Tag>Has an account</Tag>
                ) : (
                  <form action={inviteAction} className="flex items-center gap-2">
                    {w.invitedAt && <span className="text-xs text-faint">Invited {day(w.invitedAt)}</span>}
                    <input type="hidden" name="email" value={w.email} />
                    <button className="rounded-md px-2 py-1 text-xs font-medium text-accent ring-1 ring-accent/40 hover:bg-accent/10">
                      {w.invitedAt ? "Resend invite" : "Invite"}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="API usage — last 7 days" className="mt-6">
        {usage.error && /api_usage/.test(usage.error) ? (
          <p className="text-xs text-warn">Run the Phase 6 step 5 SQL in Supabase to record usage.</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-faint">Nothing recorded yet — totals appear after the next scheduled scan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Day (UTC)</th>
                  <th className="py-2 pr-3 font-medium">Who</th>
                  <th className="py-2 pr-3 text-right font-medium">eBay calls</th>
                  <th className="py-2 text-right font-medium">Price-guide calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {days.flatMap((d) => {
                  const rows = usage.data.filter((u) => u.day === d);
                  const total = rows.reduce((t, u) => ({ e: t.e + u.ebayCalls, g: t.g + u.guideCalls }), { e: 0, g: 0 });
                  return [
                    ...rows.map((u) => (
                      <tr key={`${d}-${u.scope}`}>
                        <td className="py-1.5 pr-3 text-muted">{d}</td>
                        <td className="py-1.5 pr-3">{scopeLabel(u.scope)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{u.ebayCalls.toLocaleString("en-US")}</td>
                        <td className="py-1.5 text-right tabular-nums">{u.guideCalls.toLocaleString("en-US")}</td>
                      </tr>
                    )),
                    <tr key={`${d}-total`} className="font-medium">
                      <td className="py-1.5 pr-3 text-muted">{d}</td>
                      <td className="py-1.5 pr-3">Total</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{total.e.toLocaleString("en-US")}</td>
                      <td className="py-1.5 text-right tabular-nums">{total.g.toLocaleString("en-US")}</td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-faint">Scheduled scans and Hunter runs. eBay&apos;s default limit is about 5,000 calls a day until the Growth Check raises it.</p>
          </div>
        )}
      </Panel>

      <Panel title="Services" className="mt-6">
        <ul className="divide-y divide-line text-sm">
          {status.map(([name, ok, need]) => (
            <li key={name} className="flex items-center justify-between gap-3 py-2">
              <span>{name}</span>
              <Tag tone={ok ? "default" : "warn"}>{ok ? "Connected" : `Add ${need}`}</Tag>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
