/**
 * Server-side Supabase client.
 *
 * SECURITY: this uses the SECRET key, so it must only ever be imported by
 * server code (pages, server actions, src/data/db.ts) — never by a file
 * starting with "use client". The env vars have no NEXT_PUBLIC_ prefix, so
 * Next.js will not send them to the browser even by accident.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function db(): SupabaseClient {
  if (!dbConfigured()) {
    throw new Error("Database not configured — add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local");
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// ---------- Phase 6 step 3: queries that run AS the signed-in person ----------
// With the publishable key + the person's own sign-in token, Supabase's database rules (row-level
// security) only let them reach their own rows — a second lock behind the app's own filtering.

export function userDbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

const userClients = new Map<string, SupabaseClient>();

/** A database client that acts as the person this access token belongs to. */
export function userDb(accessToken: string): SupabaseClient {
  if (!userDbConfigured()) throw new Error("SUPABASE_PUBLISHABLE_KEY missing");
  const hit = userClients.get(accessToken);
  if (hit) return hit;
  const c = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_PUBLISHABLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  if (userClients.size > 200) userClients.delete(userClients.keys().next().value as string);
  userClients.set(accessToken, c);
  return c;
}
