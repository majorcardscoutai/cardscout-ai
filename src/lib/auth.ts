/**
 * Simple single-password protection for a private app.
 * Works in both the middleware (Edge) and server actions (Node) — it only
 * uses the standard Web Crypto API.
 *
 * The login cookie holds a SHA-256 fingerprint of APP_PASSWORD, never the
 * password itself. Changing APP_PASSWORD logs out every device.
 */
export const AUTH_COOKIE = "cs_session";
export const SESSION_DAYS = 30;

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`cardscout-ai:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Only allow redirects to pages inside this app (prevents open redirects). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/login")) return "/";
  return raw;
}
