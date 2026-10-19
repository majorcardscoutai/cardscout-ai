import { NextResponse } from "next/server";
import { listScanOwners } from "@/data/db";
import { runAsUser } from "@/data/owner";
import { mergeSummaries, runAllScans, type ScanSummary } from "@/data/scanner";

/**
 * Scheduled scan endpoint. Called by:
 *  - GitHub Actions every 3 hours (.github/workflows/scan.yml), and
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
  // Each account's searches run with that account's settings, rules and alerts.
  // (Phase 6 step 5 shares eBay searches between accounts and spreads big runs over several calls.)
  const owners = await listScanOwners();
  if (owners.error) return NextResponse.json({ ok: false, error: owners.error }, { status: 500 });
  const runs: ScanSummary[] = [];
  for (const uid of owners.data) {
    runs.push(
      await runAsUser(uid, () =>
        only === "hunter" || only === "hunter-quick"
          ? runAllScans("hunter", { only })
          : runAllScans(params.get("source") === "github" ? "schedule" : "daily"),
      ),
    );
  }
  const summary = mergeSummaries(runs);
  return NextResponse.json({ ok: summary.errors.length === 0, accounts: owners.data.length, ...summary });
}
