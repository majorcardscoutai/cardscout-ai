"use server";
/**
 * Server actions for phone notifications, called from the Settings page.
 * Protected by the same login as every page (middleware).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deletePushSubscription, savePushSubscription } from "@/data/db";
import { pushToAllDevices } from "@/data/notify";
import { parseSubscription, pushConfigured } from "@/lib/webpush";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function subscribePushAction(raw: unknown, label: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushConfigured()) return { ok: false, error: "Push isn't set up on the server yet (VAPID keys missing in Vercel)." };
  const parsed = parseSubscription(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const err = await savePushSubscription({ ...parsed.value, label: label.slice(0, 60) || null });
  if (err && /push_subscriptions/.test(err))
    return { ok: false, error: "Notifications need a one-time database update — run the Phase 5 SQL in Supabase, then try again." };
  if (err) return { ok: false, error: `Couldn't save: ${err}` };
  revalidatePath("/settings");
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const err = await deletePushSubscription({ endpoint: String(endpoint).slice(0, 1000) });
  revalidatePath("/settings");
  return err ? { ok: false, error: err } : { ok: true };
}

function back(key: "saved" | "error", value: string): never {
  redirect(`/settings?${key}=${encodeURIComponent(value)}#alerts`);
}

export async function removeDeviceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("error", "Invalid item.");
  const err = await deletePushSubscription({ id });
  if (err) back("error", `Couldn't remove: ${err}`);
  revalidatePath("/settings");
  back("saved", "Device removed — it won't get notifications any more.");
}

export async function testPushAction() {
  const r = await pushToAllDevices({
    title: "CardScout test",
    body: "Notifications are working. Deals will arrive like this.",
    url: "/deals",
    tag: "cardscout-test",
  });
  if (r.devices === 0) back("error", "No devices are signed up yet — tap “Turn on notifications” on your phone first.");
  if (r.sent === 0) back("error", `Test failed: ${r.errors.join("; ") || "device no longer subscribed (removed)"}`);
  back("saved", `Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}${r.errors.length ? ` (problems: ${r.errors.join("; ")})` : ""}.`);
}
