/**
 * Who is using CardHawk right now (server only). Phase 6 step 1: shown in Settings; later steps use the
 * account id to keep each person's data separate.
 */
import { cookies } from "next/headers";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";
import { AT_COOKIE, isAdminEmail, userForToken } from "@/lib/supabase-auth";

export type Viewer =
  | { kind: "account"; id: string; email: string; admin: boolean }
  | { kind: "password"; admin: true } // the old shared site password (only Travis has it)
  | null;

export async function currentViewer(): Promise<Viewer> {
  const jar = await cookies();
  const user = await userForToken(jar.get(AT_COOKIE)?.value);
  if (user) return { kind: "account", id: user.id, email: user.email, admin: isAdminEmail(user.email) };
  const password = process.env.APP_PASSWORD;
  const old = jar.get(AUTH_COOKIE)?.value;
  if (password && old && old === (await sessionToken(password))) return { kind: "password", admin: true };
  return null;
}
