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
