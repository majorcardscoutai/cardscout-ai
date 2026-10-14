"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/app/push-actions";

type State =
  | "checking"
  | "unsupported" // browser can't do push (on iPhone: not opened from the Home Screen icon, or iOS < 16.4)
  | "denied" // permission blocked in phone settings
  | "off"
  | "on"
  | "working";

function keyToBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Browser";
}

export default function PushSetup({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsIos(/iPhone|iPad/.test(navigator.userAgent));
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function turnOn() {
    if (!publicKey) return;
    setMsg(null);
    // Ask first, straight from the tap — iPhone only allows the prompt from a direct tap.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    setState("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) as BufferSource }));
      const r = await subscribePushAction(sub.toJSON(), deviceLabel());
      if (!r.ok) {
        await sub.unsubscribe().catch(() => {});
        setMsg(r.error ?? "Couldn't turn on notifications.");
        setState("off");
        return;
      }
      setMsg("Notifications are on for this device. Tap “Send test notification” to check.");
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setMsg("Notifications are off for this device.");
    } finally {
      setState("off");
    }
  }

  if (!publicKey) {
    return (
      <p className="text-sm text-warn">
        Not set up on the server yet — add <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> in Vercel (steps in PROGRESS.md).
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {state === "checking" && <p className="text-muted">Checking this device…</p>}

      {state === "unsupported" && (
        <div className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-warn">
          {isIos ? (
            <>
              On iPhone, notifications only work from the <strong>Home Screen app</strong>: open CardScout from its Home Screen
              icon (not Safari), then come back to Settings. Needs iOS 16.4 or later.
            </>
          ) : (
            <>This browser doesn&apos;t support notifications. Try Chrome, Edge, Firefox or Safari.</>
          )}
        </div>
      )}

      {state === "denied" && (
        <div className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-warn">
          Notifications are blocked for CardScout on this device.{" "}
          {isIos ? "Turn them on in iPhone Settings → Notifications → CardScout." : "Allow them in your browser's site settings."}
        </div>
      )}

      {(state === "off" || state === "working") && (
        <button
          onClick={turnOn}
          disabled={state === "working"}
          className="rounded-lg bg-gain px-4 py-2 font-medium text-bg disabled:opacity-60"
        >
          {state === "working" ? "Turning on…" : "Turn on notifications on this device"}
        </button>
      )}

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-gain/40 bg-gain-soft px-3 py-1 text-xs font-medium text-gain">
            <span className="h-2 w-2 rounded-full bg-gain" /> On for this device
          </span>
          <button onClick={turnOff} className="text-xs text-muted hover:text-loss">
            Turn off on this device
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
