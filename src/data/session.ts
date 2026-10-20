/**
 * Who is using CardHawk right now (server only). Each person's data is kept separate by this id
 * (see data/owner.ts).
 */
import { cookies } from "next/headers";
import { AT_COOKIE, isAdminEmail, userForToken } from "@/lib/supabase-auth";

export type Viewer = { kind: "account"; id: string; email: string; admin: boolean } | null;

export async function currentViewer(): Promise<Viewer> {
  const jar = await cookies();
  const user = await userForToken(jar.get(AT_COOKIE)?.value);
  if (!user) return null;
  // Keep the account's email on file for alerts (once per server instance).
  const { recordProfile } = await import("@/data/db");
  await recordProfile(user.id, user.email);
  return { kind: "account", id: user.id, email: user.email, admin: isAdminEmail(user.email) };
}
