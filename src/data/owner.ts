/**
 * Whose data a database call is for (Phase 6 step 2). Server only.
 *
 * - On a page or form: the signed-in account.
 * - In scheduled scans (no one signed in): the scan runs "as" each account in turn — runAsUser().
 *
 * tbl("watchlist") hands back a table that can only see and change that person's rows: reads, updates
 * and deletes are filtered by user_id, and inserts are stamped with it. Shared tables (price-guide
 * values, PSA certs, Popular sets, waitlist) are returned unchanged.
 *
 * Step 3: on pages and forms, per-account tables are also queried AS the signed-in person (their
 * token + the publishable key), so the database's own rules block other accounts' rows too.
 * Scheduled scans have no sign-in token and use the server key with the user_id filter.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { currentViewer } from "@/data/session";
import { AT_COOKIE } from "@/lib/supabase-auth";
import { db, userDb, userDbConfigured } from "@/lib/supabase";

export const PER_USER_TABLES = new Set([
  "settings",
  "hunter_config",
  "saved_searches",
  "scan_hits",
  "scan_runs",
  "watchlist",
  "holdings",
  "card_values",
  "push_subscriptions",
  "value_rejections",
]);

const als = new AsyncLocalStorage<{ userId: string }>();

/** Tests only: run as a signed-in visitor would (outside any scheduled run). */
export function __outsideScheduledRun<T>(fn: () => Promise<T>): Promise<T> {
  return als.exit(fn);
}

/** Run scheduled work for one account. */
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ userId }, fn);
}

export async function ownerId(): Promise<string> {
  return (await owner()).id;
}

async function owner(): Promise<{ id: string; token: string | null }> {
  const store = als.getStore();
  if (store) return { id: store.userId, token: null };
  const v = await currentViewer();
  if (!v) throw new Error("Not signed in");
  const token = (await cookies()).get(AT_COOKIE)?.value ?? null;
  return { id: v.id, token };
}

/** Is the database's own per-account rule (row-level security) being used for this person's queries? */
export function databaseRulesOn(): boolean {
  return userDbConfigured();
}

type Row = Record<string, unknown>;
const stamp = (v: Row | Row[], uid: string) => (Array.isArray(v) ? v.map((r) => ({ ...r, user_id: uid })) : { ...v, user_id: uid });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;
/** Same type as db().from(table), so every query keeps Supabase's own types. */
type Table = ReturnType<ReturnType<typeof db>["from"]>;

export async function tbl(table: string): Promise<Table> {
  return (await scopedTable(table)) as unknown as Table;
}

async function scopedTable(table: string): Promise<AnyQuery> {
  // Wrapped (not returned as-is) so awaiting tbl() never runs a query by accident.
  if (!PER_USER_TABLES.has(table)) {
    const q: AnyQuery = db().from(table);
    return {
      select: (...a: unknown[]) => q.select(...a),
      insert: (v: Row | Row[], o?: unknown) => q.insert(v, o),
      upsert: (v: Row | Row[], o?: unknown) => q.upsert(v, o),
      update: (v: Row, o?: unknown) => q.update(v, o),
      delete: (o?: unknown) => q.delete(o),
    };
  }
  const { id: uid, token } = await owner();
  const q: AnyQuery = (token && userDbConfigured() ? userDb(token) : db()).from(table);
  return {
    select: (...a: unknown[]) => q.select(...a).eq("user_id", uid),
    insert: (v: Row | Row[], o?: unknown) => q.insert(stamp(v, uid), o),
    upsert: (v: Row | Row[], o?: unknown) => q.upsert(stamp(v, uid), o),
    update: (v: Row, o?: unknown) => q.update(v, o).eq("user_id", uid),
    delete: (o?: unknown) => q.delete(o).eq("user_id", uid),
  };
}
