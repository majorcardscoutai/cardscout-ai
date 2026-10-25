/**
 * Phone notifications for new deals (Web Push). Sent alongside the email alert.
 * Dead subscriptions (phone removed the app, permission revoked) are deleted automatically.
 */
import { moneyPair } from "@/lib/currency";
import type { ScanHit } from "@/lib/scan";
import { pushConfigured, sendPush, type PushMessage } from "@/lib/webpush";
import { deletePushSubscription, listPushSubscriptions, markPushResult } from "./db";

export interface PushSummary {
  devices: number;
  sent: number;
  removed: number;
  errors: string[];
}

/** fx > 0 = buyer in Australia: amounts in A$. */
export function dealsMessage(hits: ScanHit[], fx = 0): PushMessage {
  const best = [...hits].sort((a, b) => (b.netProfitUsd ?? 0) - (a.netProfitUsd ?? 0))[0];
  const n = hits.length;
  const profit = best.netProfitUsd !== null ? ` · +${moneyPair(best.netProfitUsd, fx).main}` : "";
  const roi = best.roiPercent !== null ? ` (${Math.round(best.roiPercent)}% ROI)` : "";
  const price = best.priceUsd !== null ? moneyPair(best.priceUsd, fx).main : "";
  return {
    title: n === 1 ? "CardHawk: new deal" : `CardHawk: ${n} new deals`,
    // Price-guide values carry their source (SportsCardsPro / PriceCharting attribution).
    body: `${best.title.slice(0, 90)} — ${price}${profit}${roi}${best.valueSource === "pricecharting" ? " · value: PriceCharting" : best.valueSource === "sportscardspro" ? " · value: SportsCardsPro" : ""}`,
    url: "/deals",
    tag: "cardscout-deals",
  };
}

export async function pushToAllDevices(msg: PushMessage): Promise<PushSummary> {
  const out: PushSummary = { devices: 0, sent: 0, removed: 0, errors: [] };
  if (!pushConfigured()) return out;
  const subs = await listPushSubscriptions();
  if (subs.error) {
    out.errors.push(`Push: ${subs.error}`);
    return out;
  }
  out.devices = subs.data.length;
  for (const s of subs.data) {
    const r = await sendPush(s, msg);
    if (r.ok) {
      out.sent++;
      await markPushResult(s.id, true, null);
    } else if (r.gone) {
      out.removed++;
      await deletePushSubscription({ id: s.id });
    } else {
      out.errors.push(`Push (${s.label ?? "device"}): ${r.error}`);
      await markPushResult(s.id, false, r.error);
    }
  }
  return out;
}
