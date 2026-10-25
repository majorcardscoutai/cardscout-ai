"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addToWaitlist, recordTermsAccepted } from "@/data/db";
import { AUTH_COOKIE, safeNextPath } from "@/lib/auth";
import { parseWaitlistForm } from "@/lib/forms";
import {
  AT_COOKIE,
  RT_COOKIE,
  passwordProblem,
  sendPasswordReset,
  sessionCookieOptions,
  signInWithPassword,
  signOutToken,
  updatePassword,
  userForToken,
} from "@/lib/supabase-auth";

const slow = () => new Promise((r) => setTimeout(r, 800)); // makes password guessing slower

async function saveSession(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  jar.set(AT_COOKIE, accessToken, sessionCookieOptions());
  jar.set(RT_COOKIE, refreshToken, sessionCookieOptions());
}

/** Sign in with an account (email + password). */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const back = (msg: string) => `/login?account=${encodeURIComponent(msg)}&email=${encodeURIComponent(email.slice(0, 254))}&next=${encodeURIComponent(next)}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) redirect(back("Enter your email address."));
  if (!password || password.length > 200) redirect(back("Enter your password."));
  const r = await signInWithPassword(email, password);
  if (!r.ok) {
    if (r.code === "credentials") await slow();
    redirect(back(r.error));
  }
  await saveSession(r.data.accessToken, r.data.refreshToken);
  redirect(next);
}

/** "Forgot password?" — emails a reset link (same message whether or not the account exists). */
export async function forgotPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    redirect(`/login/forgot?error=${encodeURIComponent("Enter the email address you sign in with.")}`);
  const appUrl = (process.env.APP_URL ?? "https://cardscout-ai.vercel.app").replace(/\/+$/, "");
  const r = await sendPasswordReset(email, `${appUrl}/auth/reset`);
  if (!r.ok && (r.code === "rate" || r.code === "config")) redirect(`/login/forgot?error=${encodeURIComponent(r.error)}`);
  redirect("/login/forgot?sent=1");
}

/** New password from the emailed link (reset now, invites later). Signs you in afterwards. */
export async function completePasswordReset(_prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const at = String(formData.get("at") ?? "");
  const rt = String(formData.get("rt") ?? "");
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("confirm") ?? ""));
  if (problem) return { error: problem };
  if (!at || !rt) return { error: "That link is incomplete. Ask for a new one." };
  const invite = formData.get("invite") === "1";
  if (invite && formData.get("agree") !== "on") return { error: "Please confirm you're 18 or older and agree to the Terms of Use and Privacy Policy." };
  const r = await updatePassword(at, password);
  if (!r.ok) return { error: r.error };
  await saveSession(at, rt);
  if (invite) {
    await recordTermsAccepted(r.data.id, r.data.email);
    redirect("/?welcome=1");
  }
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  const at = jar.get(AT_COOKIE)?.value;
  if (at && (await userForToken(at))) await signOutToken(at);
  jar.delete(AT_COOKIE);
  jar.delete(RT_COOKIE);
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

/** Public: join the waitlist from the login page. No login needed. */
export async function joinWaitlist(formData: FormData) {
  const parsed = parseWaitlistForm(formData);
  // Bots that fill the hidden field get a normal-looking "thanks" and nothing is saved.
  if (!parsed.ok && parsed.spam) redirect("/login?joined=1#waitlist");
  if (!parsed.ok) redirect(`/login?wl=${encodeURIComponent(parsed.error)}#waitlist`);
  await new Promise((r) => setTimeout(r, 300)); // gentle brake on rapid automated sign-ups
  const err = await addToWaitlist(parsed.value);
  if (err) {
    console.error("waitlist:", err);
    redirect(`/login?wl=${encodeURIComponent("Sorry — sign-ups aren't working right now. Please try again later.")}#waitlist`);
  }
  redirect("/login?joined=1#waitlist");
}
