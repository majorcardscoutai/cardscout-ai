"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addToWaitlist } from "@/data/db";
import { AUTH_COOKIE, SESSION_DAYS, safeNextPath, sessionToken } from "@/lib/auth";
import { parseWaitlistForm } from "@/lib/forms";

export async function login(formData: FormData) {
  const password = process.env.APP_PASSWORD;
  const attempt = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!password) redirect("/login?error=not-configured");

  if (attempt !== password) {
    // Small delay makes password guessing slower.
    await new Promise((r) => setTimeout(r, 800));
    redirect(`/login?error=wrong&next=${encodeURIComponent(next)}`);
  }

  const jar = await cookies();
  jar.set(AUTH_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  redirect(next);
}

export async function logout() {
  const jar = await cookies();
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
