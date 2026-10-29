import { NextResponse } from "next/server";
import { systemHealth } from "@/data/health";

/**
 * Health check for an outside uptime monitor (e.g. UptimeRobot or cron-job.org), so you're emailed if
 * automatic scanning stops — even when GitHub's own scheduler is the thing that stopped.
 *
 *   GET /api/cron/health?key=<HEALTH_KEY>   →  200 {"ok":true,...}  or  503 {"ok":false,"problems":[...]}
 *
 * Without HEALTH_KEY set in Vercel the endpoint is switched off (404). Wrong key → 401.
 * It reveals only run timings and error text, never anyone's cards or deals.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = process.env.HEALTH_KEY;
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const given = new URL(req.url).searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (given !== key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const h = await systemHealth();
  return NextResponse.json(h, { status: h.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
