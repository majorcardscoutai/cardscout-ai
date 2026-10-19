/**
 * Sign-in helpers shared by the middleware (Edge) and server actions (Node).
 * Accounts themselves live in lib/supabase-auth.ts.
 */

/** The old shared-password cookie (retired in Phase 6 step 2) — only deleted on sign-out now. */
export const AUTH_COOKIE = "cs_session";

/** Only allow redirects to pages inside this app (prevents open redirects). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/login")) return "/";
  return raw;
}
