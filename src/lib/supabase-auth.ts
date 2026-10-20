/**
 * Accounts (Phase 6, step 1): Supabase Auth over its REST API — server-side only, no browser keys.
 * Works in the middleware (Edge) and on the server (Node): it only uses fetch.
 *
 * - Sign-in: email + password → an access token (1 hour) and a refresh token, kept in httpOnly cookies.
 * - Every request: the access token is checked with Supabase (cached for a few minutes); when it has
 *   expired, the refresh token gets a new pair.
 * - Invite-only: there is no public sign-up. Accounts are created in Supabase (and later from the Admin page).
 */
export const AT_COOKIE = "ch_at";
export const RT_COOKIE = "ch_rt";
export const ACCOUNT_SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;

export interface AuthUser {
  id: string;
  email: string;
}
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
export type AuthFailure = { ok: false; error: string; code: "credentials" | "unconfirmed" | "rate" | "config" | "network" | "invalid" };
export type AuthResult<T> = { ok: true; data: T } | AuthFailure;

function api(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  // A publishable key is used if set; otherwise the server's secret key (never sent to browsers).
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export function accountsConfigured(): boolean {
  return api() !== null;
}

async function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<{ status: number; json: Record<string, unknown> | null } | null> {
  const a = api();
  if (!a) return null;
  try {
    const res = await fetch(`${a.url}/auth/v1/${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: a.key,
        "Content-Type": "application/json",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
    } as RequestInit);
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

function userFrom(j: unknown): AuthUser | null {
  const u = j as { id?: unknown; email?: unknown } | null;
  return u && typeof u.id === "string" && typeof u.email === "string" ? { id: u.id, email: u.email.toLowerCase() } : null;
}

function sessionFrom(j: Record<string, unknown> | null): AuthSession | null {
  if (!j || typeof j.access_token !== "string" || typeof j.refresh_token !== "string") return null;
  const user = userFrom(j.user);
  return user ? { accessToken: j.access_token, refreshToken: j.refresh_token, user } : null;
}

function failure(status: number, j: Record<string, unknown> | null): AuthFailure {
  const text = `${j?.error_code ?? ""} ${j?.error ?? ""} ${j?.msg ?? ""} ${j?.error_description ?? ""}`.toLowerCase();
  if (status === 0) return { ok: false, code: "network", error: "Couldn't reach the sign-in service. Try again in a moment." };
  if (status === 429 || /rate limit|too many/.test(text)) return { ok: false, code: "rate", error: "Too many attempts. Wait a few minutes and try again." };
  if (/not.?confirmed/.test(text)) return { ok: false, code: "unconfirmed", error: "This email address hasn't been confirmed yet." };
  if (/invalid api key|no api key/.test(text)) return { ok: false, code: "config", error: "Sign-in isn't set up correctly (Supabase key)." };
  if (status === 400 || status === 401 || status === 403 || status === 422) return { ok: false, code: "credentials", error: "That email and password don't match an account." };
  return { ok: false, code: "network", error: `The sign-in service returned an error (HTTP ${status}).` };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult<AuthSession>> {
  const r = await call("token?grant_type=password", { method: "POST", body: { email: email.trim().toLowerCase(), password } });
  if (!r) return { ok: false, code: "config", error: "Accounts aren't set up (SUPABASE_URL / key missing)." };
  const s = r.status === 200 ? sessionFrom(r.json) : null;
  if (s) remember(s.accessToken, s.user);
  return s ? { ok: true, data: s } : failure(r.status, r.json);
}

export async function refreshSession(refreshToken: string): Promise<AuthResult<AuthSession>> {
  const r = await call("token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refreshToken } });
  if (!r) return { ok: false, code: "config", error: "Accounts aren't set up." };
  const s = r.status === 200 ? sessionFrom(r.json) : null;
  if (s) remember(s.accessToken, s.user);
  return s ? { ok: true, data: s } : failure(r.status, r.json);
}

// Checked tokens are remembered briefly so pages don't ask Supabase on every click.
const CACHE_MS = 5 * 60_000;
const verified = new Map<string, { user: AuthUser; until: number }>();
function remember(token: string, user: AuthUser) {
  if (verified.size > 500) verified.delete(verified.keys().next().value as string);
  verified.set(token, { user, until: Date.now() + Math.min(CACHE_MS, Math.max(0, tokenExpiry(token) - Date.now())) });
}

/** The token's own expiry time (ms), read without trusting it — Supabase still checks the signature. */
export function tokenExpiry(token: string): number {
  try {
    const part = token.split(".")[1] ?? "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Who this access token belongs to (null if it's invalid or expired). */
export async function userForToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token || token.length > 4096) return null;
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  verified.delete(token);
  if (tokenExpiry(token) <= Date.now()) return null; // expired — needs a refresh, no point asking
  const r = await call("user", { token });
  const user = r && r.status === 200 ? userFrom(r.json) : null;
  if (user) remember(token, user);
  return user;
}

/** Email a password-reset link. Always looks successful (never reveals whether an account exists). */
export async function sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult<null>> {
  const r = await call(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: { email: email.trim().toLowerCase() } });
  if (!r) return { ok: false, code: "config", error: "Accounts aren't set up." };
  if (r.status === 429) return failure(429, r.json);
  return { ok: true, data: null };
}

export async function updatePassword(accessToken: string, password: string): Promise<AuthResult<AuthUser>> {
  const r = await call("user", { method: "PUT", token: accessToken, body: { password } });
  if (!r) return { ok: false, code: "config", error: "Accounts aren't set up." };
  const user = r.status === 200 ? userFrom(r.json) : null;
  if (user) return { ok: true, data: user };
  const f = failure(r.status, r.json);
  return f.code === "credentials" ? { ok: false, code: "invalid", error: "That link has expired or was already used. Ask for a new one." } : f;
}

export async function signOutToken(accessToken: string | undefined): Promise<void> {
  if (!accessToken) return;
  verified.delete(accessToken);
  await call("logout", { method: "POST", token: accessToken });
}

/** Admins (you): emails listed in ADMIN_EMAILS (comma-separated). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 72) return "Use at most 72 characters.";
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * ACCOUNT_SESSION_DAYS,
  };
}

/** For tests only. */
export function __clearAuthCache() {
  verified.clear();
}

// ---------- Admin actions (server secret key only): invites and account deletion ----------

function adminApi(): { url: string; headers: Record<string, string> } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  // New-style keys (sb_secret_…) go in "apikey"; an older service_role key is also sent as the bearer token.
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/+$/, ""), headers };
}

/** Email an invite: the link lets them choose a password (lands on /auth/reset). */
export async function inviteUser(email: string, redirectTo: string): Promise<AuthResult<AuthUser> | { ok: false; code: "exists"; error: string }> {
  const a = adminApi();
  if (!a) return { ok: false, code: "config", error: "Accounts aren't set up (SUPABASE_URL / SUPABASE_SECRET_KEY)." };
  try {
    const res = await fetch(`${a.url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: a.headers,
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      cache: "no-store",
    } as RequestInit);
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const user = res.ok ? userFrom(json) : null;
    if (user) return { ok: true, data: user };
    const text = `${json?.error_code ?? ""} ${json?.msg ?? ""} ${json?.error_description ?? ""}`.toLowerCase();
    if (/already|exists|registered/.test(text)) return { ok: false, code: "exists", error: "That email already has an account." };
    if (/email.*(send|deliver)|smtp|rate limit/.test(text) || res.status === 429)
      return { ok: false, code: "rate", error: "Supabase couldn't send the invite email (its built-in email only reaches your own team and a few per hour — set up Resend as its email sender)." };
    return failure(res.status, json);
  } catch {
    return { ok: false, code: "network", error: "Couldn't reach the sign-in service." };
  }
}

/** Permanently delete an account. Its rows go too (every per-account table cascades on delete). */
export async function deleteUser(userId: string): Promise<string | null> {
  const a = adminApi();
  if (!a) return "Accounts aren't set up.";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return "Invalid account.";
  try {
    const res = await fetch(`${a.url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: a.headers, cache: "no-store" } as RequestInit);
    return res.ok ? null : `The sign-in service returned an error (HTTP ${res.status}).`;
  } catch {
    return "Couldn't reach the sign-in service.";
  }
}
