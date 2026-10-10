"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, SESSION_DAYS, safeNextPath, sessionToken } from "@/lib/auth";

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
