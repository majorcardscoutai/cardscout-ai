/**
 * Whose data a database call is for (Phase 6 step 2). Server only.
 *
 * - On a page or form: the signed-in account.
 * - In scheduled scans (no one signed in): the scan runs "as" each account in turn — runAsUser().
 *
 * tbl("watchlist") hands back a table that can only see and change that person's rows: reads, updates
 * and deletes are filtered by user_id, and inserts are stamped with it. Shared tables (price-guide
 * values, PSA certs, Popular sets, waitlist) are returned unchanged.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { currentViewer } from "@/data/session";
import { db } from "@/lib/supabase";

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
]);

const als = new AsyncLocalStorage<{ userId: string }>();

/** Run scheduled work for one account. */
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ userId }, fn);
}

export async function ownerId(): Promise<string> {
  const store = als.getStore();
  if (store) return store.userId;
  const v = await currentViewer();
  if (v) return v.id;
  throw new Error("Not signed in");
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
  const q: AnyQuery = db().from(table);
  // Wrapped (not returned as-is) so awaiting tbl() never runs a query by accident.
  if (!PER_USER_TABLES.has(table))
    return {
      select: (...a: unknown[]) => q.select(...a),
      insert: (v: Row | Row[], o?: unknown) => q.insert(v, o),
      upsert: (v: Row | Row[], o?: unknown) => q.upsert(v, o),
      update: (v: Row, o?: unknown) => q.update(v, o),
      delete: (o?: unknown) => q.delete(o),
    };
  const uid = await ownerId();
  return {
    select: (...a: unknown[]) => q.select(...a).eq("user_id", uid),
    insert: (v: Row | Row[], o?: unknown) => q.insert(stamp(v, uid), o),
    upsert: (v: Row | Row[], o?: unknown) => q.upsert(stamp(v, uid), o),
    update: (v: Row, o?: unknown) => q.update(v, o).eq("user_id", uid),
    delete: (o?: unknown) => q.delete(o).eq("user_id", uid),
  };
}
