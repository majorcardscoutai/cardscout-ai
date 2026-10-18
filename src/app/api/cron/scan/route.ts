import { NextResponse } from "next/server";
import { runAllScans } from "@/data/scanner";

/**
 * Scheduled scan endpoint. Called by:
 *  - GitHub Actions every 3 hours (.github/workflows/scan.yml), and
 *  - Vercel's daily cron as a backup (vercel.json), and
 *  - GitHub Actions every 30 minutes with ?only=hunter (.github/workflows/hunt.yml) for the Profit Hunter.
 * Both send "Authorization: Bearer <CRON_SECRET>". Anyone without it gets 401.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  // ?only=hunter → the hourly Profit Hunter run (saved searches keep their 3-hourly schedule).
  const summary =
    params.get("only") === "hunter"
      ? await runAllScans("hunter", { only: "hunter" })
      : await runAllScans(params.get("source") === "github" ? "schedule" : "daily");
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
