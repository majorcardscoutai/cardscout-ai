"use client";

import { useActionState, useEffect, useState } from "react";
import { completePasswordReset } from "@/app/login/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/supabase-auth";

type LinkState =
  | { kind: "loading" }
  | { kind: "ok"; at: string; rt: string; invite: boolean }
  | { kind: "bad"; message: string };

/**
 * Supabase puts the one-time sign-in tokens after the "#" in the emailed link, which only the browser
 * can read. They're moved into the form (and wiped from the address bar) so the password can be saved.
 */
export function readLink(hash: string): LinkState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.get("error") || p.get("error_code")) {
    const expired = /expired/i.test(`${p.get("error_code")} ${p.get("error_description")}`);
    return { kind: "bad", message: expired ? "That link has expired. Ask for a new one." : "That link isn't valid any more. Ask for a new one." };
  }
  const at = p.get("access_token");
  const rt = p.get("refresh_token");
  if (!at || !rt) return { kind: "bad", message: "Open this page from the link in your email." };
  return { kind: "ok", at, rt, invite: p.get("type") === "invite" };
}

export default function NewPasswordForm() {
  const [link, setLink] = useState<LinkState>({ kind: "loading" });
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(completePasswordReset, null);

  useEffect(() => {
    setLink(readLink(window.location.hash));
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const inputCls = "mt-1 w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent";
  if (link.kind === "loading") return <p className="text-sm text-muted">Checking your link…</p>;
  if (link.kind === "bad")
    return (
      <p className="text-sm text-loss">
        {link.message}{" "}
        <a href="/login/forgot" className="text-accent underline">
          Get a new link
        </a>
      </p>
    );
  return (
    <form action={action}>
      <p className="mb-4 text-sm text-muted">{link.invite ? "Welcome! Choose a password for your CardHawk account." : "Choose a new password."}</p>
      <input type="hidden" name="at" value={link.at} />
      <input type="hidden" name="rt" value={link.rt} />
      <label className="block">
        <span className="text-xs text-muted">New password (at least {MIN_PASSWORD_LENGTH} characters)</span>
        <input type="password" name="password" required minLength={MIN_PASSWORD_LENGTH} maxLength={72} autoComplete="new-password" className={inputCls} />
      </label>
      <label className="mt-3 block">
        <span className="text-xs text-muted">Type it again</span>
        <input type="password" name="confirm" required minLength={MIN_PASSWORD_LENGTH} maxLength={72} autoComplete="new-password" className={inputCls} />
      </label>
      {state?.error && <p className="mt-3 text-sm text-loss">{state.error}</p>}
      <button disabled={pending} className="mt-5 w-full rounded-lg bg-gain px-4 py-2.5 text-sm font-semibold text-bg hover:bg-gain/90 disabled:opacity-60">
        {pending ? "Saving…" : "Save password and sign in"}
      </button>
    </form>
  );
}
