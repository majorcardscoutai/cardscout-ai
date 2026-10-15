import { NextResponse } from "next/server";
import { listWaitlist } from "@/data/db";

/** Download the waitlist as CSV. Behind the login (middleware), so only you can open it. */
export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  const r = await listWaitlist();
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  const rows = [["email", "collects", "joined"], ...r.data.map((w) => [w.email, w.interests.join(" "), w.createdAt])];
  const csv = rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cardhawk-waitlist.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
