/**
 * Deal alert emails via Resend (https://resend.com) — free tier, no extra package.
 * Server-only (uses RESEND_API_KEY). Without the key, alerts simply aren't emailed; they still appear
 * in the app. Each account's alerts go to its own sign-in email (admins: ALERT_EMAIL if set).
 * Note: until a domain is verified in Resend (ALERT_FROM on that domain), Resend only delivers to the
 * Resend account owner's own address.
 */
import { moneyPair } from "./currency";
import type { ScanHit } from "./scan";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Where an account's alert emails go: its sign-in email; admins can redirect theirs with ALERT_EMAIL. */
export function alertRecipient(accountEmail: string | null, isAdmin: boolean): string | null {
  if (isAdmin && process.env.ALERT_EMAIL) return process.env.ALERT_EMAIL;
  return accountEmail;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** `usdToAud` 0 = show US$ only (buyers outside Australia). */
export function alertEmailHtml(hits: (ScanHit & { searchName: string })[], usdToAud: number, appUrl: string): string {
  const rows = hits
    .map(
      (h) => `<tr>
  <td style="padding:12px;border-bottom:1px solid #1f2733">
    <a href="${esc(h.url)}" style="color:#e6ebf2;font-weight:600;text-decoration:none">${esc(h.title)}</a>
    <div style="color:#8492a6;font-size:12px;margin-top:4px">${esc(h.searchName)}${h.isAuction ? " · Auction ending soon" : ""} · compared with your value ${h.valueUsd !== null ? moneyPair(h.valueUsd, usdToAud).main : ""}</div>
  </td>
  <td style="padding:12px;border-bottom:1px solid #1f2733;text-align:right;white-space:nowrap;color:#e6ebf2">
    ${h.priceUsd !== null ? moneyPair(h.priceUsd, usdToAud).main : "—"}<div style="color:#5a6678;font-size:12px">${h.priceUsd !== null ? moneyPair(h.priceUsd, usdToAud).sub ?? "" : ""}</div>
  </td>
  <td style="padding:12px;border-bottom:1px solid #1f2733;text-align:right;white-space:nowrap;color:#22c55e;font-weight:600">
    ${h.netProfitUsd !== null ? "+" + moneyPair(h.netProfitUsd, usdToAud).main : "—"}<div style="font-size:12px">${h.roiPercent !== null ? h.roiPercent.toFixed(1) + "% ROI" : ""}</div>
  </td>
</tr>`,
    )
    .join("");
  return `<div style="background:#080b10;padding:24px;font-family:-apple-system,Segoe UI,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#0f141b;border:1px solid #1f2733;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #1f2733;color:#e6ebf2;font-size:18px;font-weight:700">CardHawk AI · ${hits.length} new deal${hits.length === 1 ? "" : "s"}</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    <div style="padding:16px 24px;color:#5a6678;font-size:12px;line-height:1.5">
      Profit is calculated against <b>your own card values</b>, not verified sold data. Check the listing before buying.
      <br><a href="${esc(appUrl)}/scanner" style="color:#4cc2ff">Open CardHawk</a>
      <br><span style="color:#5a6678;font-size:11px">Market values from <a href="https://www.sportscardspro.com" style="color:#5a6678">SportsCardsPro</a> and <a href="https://www.pricecharting.com" style="color:#5a6678">PriceCharting</a>, unless you set your own.</span>
    </div>
  </div>
</div>`;
}

export async function sendAlertEmail(subject: string, html: string, to: string): Promise<string | null> {
  if (!emailConfigured()) return "Email not configured";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_FROM ?? "CardHawk AI <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) return `Email failed (HTTP ${res.status})`;
    return null;
  } catch {
    return "Email failed (network)";
  }
}
