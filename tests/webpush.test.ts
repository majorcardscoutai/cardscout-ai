import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import { encryptPayload, vapidJwt } from "../src/lib/webpush.js";

// RFC 8291 Appendix A — the published example message.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  result:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("encryption matches the RFC 8291 worked example byte-for-byte", () => {
  const out = encryptPayload(Buffer.from(RFC.plaintext), RFC.uaPublic, RFC.authSecret, {
    salt: Buffer.from(RFC.salt, "base64url"),
    senderPrivateKey: Buffer.from(RFC.asPrivate, "base64url"),
  });
  assert.equal(out.toString("base64url"), RFC.result);
});

test("a receiving device can decrypt a random message (round trip)", () => {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = Buffer.from("0123456789abcdef");
  const msg = JSON.stringify({ title: "CardHawk", body: "2 new deals", url: "/deals" });
  const out = encryptPayload(Buffer.from(msg), ua.getPublicKey("base64url"), auth.toString("base64url"));
  const salt = out.subarray(0, 16);
  const idlen = out[20];
  const asPublic = out.subarray(21, 21 + idlen);
  const ct = out.subarray(21 + idlen);
  const h = (k: Buffer, d: Buffer) => createHmac("sha256", k).update(d).digest();
  const ecdh = ua.computeSecret(asPublic);
  const ikm = h(h(auth, ecdh), Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = h(salt, ikm);
  const d = createDecipheriv("aes-128-gcm", h(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16), h(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12));
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2);
  assert.equal(plain.subarray(0, -1).toString(), msg);
});

test("rejects malformed subscription keys", () => {
  assert.throws(() => encryptPayload(Buffer.from("x"), "AAAA", RFC.authSecret));
  assert.throws(() => encryptPayload(Buffer.from("x"), RFC.uaPublic, "AAAA"));
});

test("VAPID token is a valid ES256 JWT for the push service origin", () => {
  const k = createECDH("prime256v1");
  k.generateKeys();
  const pub = k.getPublicKey("base64url");
  const jwt = vapidJwt("https://web.push.apple.com", "mailto:me@example.com", pub, k.getPrivateKey("base64url"), 1_000_000);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(JSON.parse(Buffer.from(c, "base64url").toString()), { aud: "https://web.push.apple.com", exp: 1_000_000 + 43200, sub: "mailto:me@example.com" });
  const raw = Buffer.from(pub, "base64url");
  const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
  assert.ok(verify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")));
  assert.throws(() => vapidJwt("https://x", "mailto:a@b", "short", "short"));
});

test("only real browser push services are accepted", async () => {
  const { parseSubscription } = await import("../src/lib/webpush.js");
  const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
  assert.equal(parseSubscription({ endpoint: "https://web.push.apple.com/QGx", keys }).ok, true);
  assert.equal(parseSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).ok, true);
  assert.equal(parseSubscription({ endpoint: "https://updates.push.services.mozilla.com/wpush/v2/x", keys }).ok, true);
  assert.equal(parseSubscription({ endpoint: "https://evil.example.com/x", keys }).ok, false);
  assert.equal(parseSubscription({ endpoint: "http://web.push.apple.com/x", keys }).ok, false);
  assert.equal(parseSubscription({ endpoint: "https://web.push.apple.com.evil.com/x", keys }).ok, false);
  assert.equal(parseSubscription({ endpoint: "https://web.push.apple.com/x", keys: { p256dh: "AAAA", auth: RFC.authSecret } }).ok, false);
  assert.equal(parseSubscription(null).ok, false);
});
