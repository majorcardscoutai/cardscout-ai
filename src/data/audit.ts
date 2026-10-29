/** Deal accuracy audit — admin only, server key (deal_audits has no per-account rows). */
import { db, dbConfigured } from "@/lib/supabase";
import type { AuditRow, Verdict } from "@/lib/audit";

export interface AuditInput {
  itemId: string;
  title: string;
  cardKey: string | null;
  priceUsd: number | null;
  valueUsd: number | null;
  roiPercent: number | null;
  score: number | null;
  needsCheck: boolean;
  verdict: Verdict;
  reason: string | null;
  auditedBy: string;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

export async function saveAudit(a: AuditInput): Promise<string | null> {
  if (!dbConfigured()) return "Database not configured";
  try {
    const { error } = await db().from("deal_audits").upsert(
      {
        item_id: a.itemId, title: a.title.slice(0, 300), card_key: a.cardKey, price_usd: a.priceUsd, value_usd: a.valueUsd,
        roi_percent: a.roiPercent, score: a.score, needs_check: a.needsCheck, verdict: a.verdict, reason: a.reason,
        audited_by: a.auditedBy, created_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (error) throw error;
    return null;
  } catch (e) {
    return msg(e);
  }
}

export async function listAudits(days = 84): Promise<{ data: (AuditRow & { title: string })[]; error: string | null }> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await db().from("deal_audits").select("item_id, title, verdict, reason, needs_check, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        itemId: String(r.item_id), title: String(r.title), verdict: r.verdict as Verdict, reason: r.reason ? String(r.reason) : null,
        needsCheck: r.needs_check === true, createdAt: String(r.created_at),
      })),
    };
  } catch (e) {
    return { data: [], error: msg(e) };
  }
}

/** "Wrong match?" taps in the last N days, every account (admins' taps reject the shared value instead — counted separately). */
export async function wrongMatchCounts(days = 7): Promise<{ lastDays: number | null; sharedRejected: number | null }> {
  if (!dbConfigured()) return { lastDays: null, sharedRejected: null };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [a, b] = await Promise.all([
    db().from("value_rejections").select("card_key", { count: "exact", head: true }).gte("created_at", since),
    db().from("provider_values").select("card_key", { count: "exact", head: true }).eq("status", "rejected"),
  ]);
  return { lastDays: a.error ? null : (a.count ?? 0), sharedRejected: b.error ? null : (b.count ?? 0) };
}
