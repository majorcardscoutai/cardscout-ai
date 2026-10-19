import HawkLogo from "@/components/HawkLogo";
import { forgotPassword } from "../actions";

export const metadata = { title: "CardHawk AI · Reset your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  const inputCls = "mt-1 w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-4 py-10">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center">
        <div className="rounded-2xl border border-line bg-panel p-6">
          <div className="mb-6 flex items-center gap-2.5">
            <HawkLogo framed className="h-12 w-12 shrink-0" />
            <div>
              <div className="font-semibold">Reset your password</div>
              <div className="text-xs text-faint">We&apos;ll email you a link</div>
            </div>
          </div>
          {sent ? (
            <p className="text-sm text-muted">
              If that email address has a CardHawk account, a reset link is on its way. It works once and expires after an hour — check
              your spam folder if it hasn&apos;t arrived in a few minutes.
            </p>
          ) : (
            <form action={forgotPassword}>
              <label className="block">
                <span className="text-xs text-muted">Email</span>
                <input type="email" name="email" required maxLength={254} autoComplete="email" className={inputCls} />
              </label>
              {error && <p className="mt-3 text-sm text-loss">{error}</p>}
              <button className="mt-5 w-full rounded-lg bg-gain px-4 py-2.5 text-sm font-semibold text-bg hover:bg-gain/90">
                Email me a reset link
              </button>
            </form>
          )}
          <div className="mt-4 text-center text-xs">
            <a href="/login" className="text-accent hover:underline">Back to sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
