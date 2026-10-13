import { NextResponse } from "next/server";
import { runAllScans } from "@/data/scanner";

/**
 * Scheduled scan endpoint. Called by:
 *  - GitHub Actions every 3 hours (.github/workflows/scan.yml), and
 *  - Vercel's daily cron as a backup (vercel.json).
 * Both send "Authorization: Bearer <CRON_SECRET>". Anyone without it gets 401.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const trigger = new URL(req.url).searchParams.get("source") === "github" ? "schedule" : "daily";
  const summary = await runAllScans(trigger);
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
