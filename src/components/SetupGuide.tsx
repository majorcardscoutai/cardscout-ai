import Link from "next/link";
import { cookies } from "next/headers";
import { hideSetupGuideAction } from "@/app/actions";
import { listPushSubscriptions, listSavedSearches, loadHunterConfig, loadSettings } from "@/data/db";

export const SETUP_HIDDEN_COOKIE = "ch_setup_hidden";

export interface SetupStep {
  done: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
  optional?: boolean;
}

/**
 * First-run checklist on the Overview, so a new account gets value in the first five minutes.
 * Shows until the three main steps are done (or it's hidden); always shows on the welcome visit.
 * null = don't show it.
 */
export async function setupGuideData(welcome = false): Promise<{ steps: SetupStep[]; welcome: boolean } | null> {
  const hidden = (await cookies()).get(SETUP_HIDDEN_COOKIE)?.value === "1";
  if (hidden && !welcome) return null;
  const [settings, searches, hunter, devices] = await Promise.all([loadSettings(), listSavedSearches(), loadHunterConfig(), listPushSubscriptions()]);
  const steps: SetupStep[] = [
    {
      done: settings.source === "database",
      title: "Set where you buy from and your costs",
      body: "Your country (for shipping quotes and import tax), selling fees and the minimum profit and ROI you want.",
      href: "/settings",
      cta: "Open Settings",
    },
    {
      done: hunter.config.enabled,
      title: "Turn on the Profit Hunter",
      body: "Pick your budget and sports. It checks new graded listings every 10 minutes and flags cards that clear your rules.",
      href: "/hunter",
      cta: "Set up the Hunter",
    },
    {
      done: searches.data.some((s) => s.kind !== "hunter"),
      title: "Save a search for cards you want",
      body: "Search for a player or set, choose graded or raw, then Save search — it's checked automatically.",
      href: "/scanner",
      cta: "Search eBay",
    },
    {
      done: devices.data.length > 0,
      title: "Get deal alerts on your phone (optional)",
      body: "Add CardHawk to your home screen, then turn on notifications in Settings.",
      href: "/settings#alerts",
      cta: "Turn on alerts",
      optional: true,
    },
  ];
  const required = steps.filter((s) => !s.optional);
  if (required.every((s) => s.done) && !welcome) return null;
  return { steps, welcome };
}

export default function SetupGuide({ data }: { data: { steps: SetupStep[]; welcome: boolean } | null }) {
  if (!data) return null;
  const { steps, welcome } = data;
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  return (
    <section className="mb-6 rounded-2xl border border-gain/30 bg-panel p-5 sm:p-6" aria-label="Getting started">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{welcome ? "Welcome to CardHawk 👋" : "Get set up"}</h2>
          <p className="mt-1 text-sm text-muted">
            {doneCount} of {required.length} done. Quick start does the main steps in one go. Every purchase happens on eBay — CardHawk finds the deals and
            works out the real profit.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/start" className="rounded-lg bg-gain px-4 py-2 text-sm font-semibold text-bg hover:bg-gain/90" data-testid="quickstart-link">
            Quick start — 1 minute
          </Link>
          <form action={hideSetupGuideAction}>
            <button className="text-xs text-faint hover:text-ink">Hide</button>
          </form>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className={`rounded-xl border p-4 ${s.done ? "border-line bg-panel-2/50" : "border-line bg-panel-2"}`}>
            <div className="flex items-start gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-gain text-bg" : "bg-panel ring-1 ring-line-strong text-muted"}`}
                aria-label={s.done ? "Done" : `Step ${i + 1}`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <div className={`text-sm font-medium ${s.done ? "text-muted line-through" : ""}`}>{s.title}</div>
                {!s.done && <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>}
                {!s.done && (
                  <Link href={s.href} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                    {s.cta} →
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
