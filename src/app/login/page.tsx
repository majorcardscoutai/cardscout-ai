import { safeNextPath } from "@/lib/auth";
import { joinWaitlist, login } from "./actions";
import HawkLogo from "@/components/HawkLogo";

export const metadata = { title: "CardHawk AI · Sign in or join the waitlist" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; joined?: string; wl?: string }>;
}) {
  const { error, next, joined, wl } = await searchParams;
  const message =
    error === "wrong"
      ? "That password isn't right."
      : error === "not-configured"
        ? "APP_PASSWORD isn't set in .env.local (or in Vercel's environment variables)."
        : null;
  const inputCls =
    "mt-1 w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent";

  return (
    // Covers the whole screen, including the sidebar. Scrolls on small phones.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-4 py-10">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-5">
        <form action={login} className="rounded-2xl border border-line bg-panel p-6">
          <div className="mb-6 flex items-center gap-2.5">
            <HawkLogo framed className="h-12 w-12 shrink-0" />
            <div>
              <div className="font-semibold">CardHawk AI</div>
              <div className="text-xs text-faint">Private — sign in to continue</div>
            </div>
          </div>
          <input type="hidden" name="next" value={safeNextPath(next)} />
          <label className="block">
            <span className="text-xs text-muted">Password</span>
            <input type="password" name="password" required autoComplete="current-password" className={inputCls} />
          </label>
          {message && <p className="mt-3 text-sm text-loss">{message}</p>}
          <button className="mt-5 w-full rounded-lg bg-gain px-4 py-2.5 text-sm font-semibold text-bg hover:bg-gain/90">
            Sign in
          </button>
        </form>

        <section id="waitlist" className="scroll-mt-10 rounded-2xl border border-gain/30 bg-panel p-6">
          {joined ? (
            <div className="text-center">
              <div className="text-lg font-semibold">You&apos;re on the list.</div>
              <p className="mt-2 text-sm text-muted">
                Thanks! We&apos;ll email you when CardHawk opens to more collectors.
              </p>
            </div>
          ) : (
            <form action={joinWaitlist}>
              <div className="text-lg font-semibold">Join the waitlist</div>
              <p className="mt-1 text-sm text-muted">
                CardHawk finds underpriced trading cards on eBay and shows the real profit after fees, GST and shipping. Be
                first to know when it opens to more collectors.
              </p>
              <label className="mt-4 block">
                <span className="text-xs text-muted">Email</span>
                <input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" className={inputCls} />
              </label>
              <fieldset className="mt-4">
                <legend className="text-xs text-muted">What do you collect? (optional)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["NBA", "NBA"],
                    ["MLB", "MLB"],
                    ["Pokemon", "Pokémon"],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm">
                      <input type="checkbox" name={`i_${k}`} className="h-4 w-4 accent-gain" /> {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {/* Hidden from people; bots fill it in. */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label>
                  Company <input type="text" name="company" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {wl && <p className="mt-3 text-sm text-loss">{wl}</p>}
              <button className="mt-5 w-full rounded-lg border border-gain bg-gain/10 px-4 py-2.5 text-sm font-semibold text-gain hover:bg-gain/20">
                Join the waitlist
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                We&apos;ll only use your email to tell you about CardHawk — no spam, and you can ask to be removed at any time.
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
