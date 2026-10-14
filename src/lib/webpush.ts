/**
 * Web Push sender — built on Node's crypto, no extra packages.
 *
 * Implements the two standards every browser push service (Apple, Google, Mozilla) uses:
 *  - RFC 8291 + RFC 8188: message encryption ("aes128gcm"), so only your device can read it.
 *  - RFC 8292 (VAPID): a signed token proving the message comes from this server.
 *
 * Keys come from environment variables (never the browser):
 *   VAPID_PUBLIC_KEY   base64url, 65-byte uncompressed P-256 public key (safe to share)
 *   VAPID_PRIVATE_KEY  base64url, 32-byte private key (SECRET)
 *   VAPID_SUBJECT      optional, "mailto:you@example.com" (defaults to ALERT_EMAIL)
 */
import { createECDH, createHmac, createPrivateKey, randomBytes, sign, createCipheriv } from "node:crypto";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/** Encrypt a payload for one subscription (RFC 8291). `salt` / `senderPrivateKey` only for tests. */
export function encryptPayload(
  plaintext: Buffer,
  uaPublicB64: string,
  authB64: string,
  opts: { salt?: Buffer; senderPrivateKey?: Buffer } = {},
): Buffer {
  const uaPublic = fromB64u(uaPublicB64);
  const authSecret = fromB64u(authB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("Invalid subscription key (p256dh).");
  if (authSecret.length !== 16) throw new Error("Invalid subscription secret (auth).");

  const sender = createECDH("prime256v1");
  if (opts.senderPrivateKey) sender.setPrivateKey(opts.senderPrivateKey);
  else sender.generateKeys();
  const asPublic = sender.getPublicKey(); // 65 bytes, uncompressed
  const ecdhSecret = sender.computeSecret(uaPublic);

  // Combine the shared secret with the subscription's auth secret.
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);

  const salt = opts.salt ?? randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  // Single record: plaintext + 0x02 delimiter (no padding).
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** VAPID JWT (ES256) for the push service's origin, valid 12 hours. */
export function vapidJwt(audience: string, subject: string, publicB64: string, privateB64: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const pub = fromB64u(publicB64);
  let priv = fromB64u(privateB64);
  // Some key generators drop a leading zero byte (about 1 in 256 keys) — pad back to 32 bytes.
  if (priv.length > 0 && priv.length < 32) priv = Buffer.concat([Buffer.alloc(32 - priv.length), priv]);
  if (pub.length !== 65 || priv.length !== 32) throw new Error("VAPID keys look wrong — regenerate them (see PROGRESS.md).");
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: b64u(priv), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject })));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${b64u(signature)}`;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export interface PushMessage {
  title: string;
  body: string;
  url?: string; // page to open when tapped
  tag?: string; // same tag replaces an older notification
}

/** Send one notification. `gone: true` means the subscription is dead — delete it. Never throws. */
export async function sendPush(sub: PushSubscriptionKeys, msg: PushMessage): Promise<PushResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { ok: false, gone: false, error: "Push isn't set up (VAPID keys missing)." };
  try {
    const endpoint = new URL(sub.endpoint);
    if (endpoint.protocol !== "https:") return { ok: false, gone: true, error: "Invalid push endpoint." };
    const subject = process.env.VAPID_SUBJECT ?? (process.env.ALERT_EMAIL ? `mailto:${process.env.ALERT_EMAIL}` : "mailto:alerts@example.com");
    const jwt = vapidJwt(endpoint.origin, subject, publicKey, privateKey);
    const body = encryptPayload(Buffer.from(JSON.stringify(msg).slice(0, 3000)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return { ok: false, gone: true, error: "This device is no longer subscribed." };
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, gone: false, error: `Push service said ${res.status}${text ? `: ${text}` : ""}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, gone: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

/**
 * Validate a subscription coming from the browser. Only real browser push services are
 * accepted, so the server never posts to an arbitrary address.
 */
export function parseSubscription(raw: unknown): { ok: true; value: PushSubscriptionKeys } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No subscription received." };
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof r.endpoint !== "string" || r.endpoint.length > 1000) return { ok: false, error: "Invalid push address." };
  let url: URL;
  try {
    url = new URL(r.endpoint);
  } catch {
    return { ok: false, error: "Invalid push address." };
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((h) => h.test(url.hostname)))
    return { ok: false, error: "That browser's push service isn't recognised." };
  const p256dh = typeof r.keys?.p256dh === "string" ? r.keys.p256dh : "";
  const auth = typeof r.keys?.auth === "string" ? r.keys.auth : "";
  if (Buffer.from(p256dh, "base64url").length !== 65 || Buffer.from(auth, "base64url").length !== 16)
    return { ok: false, error: "Invalid subscription keys." };
  return { ok: true, value: { endpoint: r.endpoint, p256dh, auth } };
}
