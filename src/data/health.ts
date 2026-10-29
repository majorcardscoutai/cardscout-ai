import { db, dbConfigured } from "@/lib/supabase";
import { healthReport, type HealthReport } from "@/lib/health";

/**
 * System-wide scan health. Reads only run times and errors (no one's cards, searches or deals) across
 * every account, with the server key — scheduled runs are recorded per account.
 */
export async function systemHealth(now = Date.now()): Promise<HealthReport> {
  if (!dbConfigured()) return { ok: false, problems: ["Database not configured."], hunterAgeMin: null, scanAgeMin: null };
  try {
    const since = new Date(now - 2 * 86_400_000).toISOString();
    const { data, error } = await db()
      .from("scan_runs")
      .select("trigger, created_at, error")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return healthReport(
      (data ?? []).map((r: Record<string, unknown>) => ({ trigger: String(r.trigger), createdAt: String(r.created_at), error: r.error ? String(r.error) : null })),
      now,
    );
  } catch (e) {
    return { ok: false, problems: [`Couldn't read scan history: ${e instanceof Error ? e.message : String(e)}`], hunterAgeMin: null, scanAgeMin: null };
  }
}
