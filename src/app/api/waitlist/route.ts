import { NextResponse } from "next/server";
import { listWaitlist } from "@/data/db";
import { currentViewer } from "@/data/session";

/** Download the waitlist as CSV. Admins only (signed in, and listed in ADMIN_EMAILS). */
export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  if (!(await currentViewer())?.admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const r = await listWaitlist();
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  const rows = [
    ["email", "based_in", "goals", "collects", "joined"],
    ...r.data.map((w) => [w.email, w.region ?? "", w.goals.join(" "), w.interests.join(" "), w.createdAt]),
  ];
  const csv = rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cardhawk-waitlist.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
