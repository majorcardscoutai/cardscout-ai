import { after, NextResponse } from "next/server";
import { runScheduledScans } from "@/data/scanner";

/**
 * Scheduled scan endpoint. Called by:
 *  - cron-job.org (preferred: on time, with ?async=1), or
 *  - GitHub Actions every 3 hours (.github/workflows/scan.yml) — can run late or be skipped, and
 *  - Vercel's daily cron as a backup (vercel.json), and
 *  - GitHub Actions hourly with ?only=hunter (full Profit Hunter run) and every 10 minutes in between with
 *    ?only=hunter-quick (newest listings only) — .github/workflows/hunt.yml and hunt-quick.yml.
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
  const only = params.get("only");
  const source = params.get("source");
  const run = () =>
    only === "hunter" || only === "hunter-quick"
      ? runScheduledScans("hunter", only)
      : runScheduledScans(source === "github" || source === "cronjob" ? "schedule" : "daily");
  // ?async=1 (cron-job.org): answer straight away and scan in the background — its free plan stops waiting
  // after 30 s, a scan can take up to 60 s. Results are recorded in scan_runs (Admin → Scanning health).
  if (params.get("async") === "1") {
    after(async () => {
      await run();
    });
    return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
  }
  const summary = await run();
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
