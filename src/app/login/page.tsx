import { safeNextPath } from "@/lib/auth";
import { login } from "./actions";

export const metadata = { title: "Sign in · CardHawk AI" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const message =
    error === "wrong"
      ? "That password isn't right."
      : error === "not-configured"
        ? "APP_PASSWORD isn't set in .env.local (or in Vercel's environment variables)."
        : null;

  return (
    // Covers the whole screen, including the sidebar.
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg px-4">
      <form action={login} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gain/15 ring-1 ring-gain/40">
            <span className="num text-sm font-bold text-gain">CH</span>
          </div>
          <div>
            <div className="font-semibold">CardHawk AI</div>
            <div className="text-xs text-faint">Private — sign in to continue</div>
          </div>
        </div>
        <input type="hidden" name="next" value={safeNextPath(next)} />
        <label className="block">
          <span className="text-xs text-muted">Password</span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        {message && <p className="mt-3 text-sm text-loss">{message}</p>}
        <button className="mt-5 w-full rounded-lg bg-gain px-4 py-2.5 text-sm font-semibold text-bg hover:bg-gain/90">
          Sign in
        </button>
      </form>
    </div>
  );
}
