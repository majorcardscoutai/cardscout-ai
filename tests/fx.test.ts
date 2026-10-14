import { test } from "node:test";
import assert from "node:assert/strict";
import { liveUsdToAud, parseFxResponse, resetFxCache } from "../src/lib/fx";

test("parseFxResponse reads v2 and v1 shapes", () => {
  assert.deepEqual(parseFxResponse({ date: "2026-10-13", base: "USD", quote: "AUD", rate: 1.52345 }), { rate: 1.5235, date: "2026-10-13" });
  assert.deepEqual(parseFxResponse({ date: "2026-10-13", base: "USD", rates: { AUD: 1.5 } }), { rate: 1.5, date: "2026-10-13" });
});

test("parseFxResponse rejects anything odd instead of wrecking every A$ figure", () => {
  for (const bad of [null, "x", {}, { rate: "1.5" }, { rate: 0 }, { rate: 150 }, { rate: NaN }, { rates: { EUR: 0.9 } }, { status: 422, message: "invalid" }]) {
    assert.equal(parseFxResponse(bad), null);
  }
});

test("liveUsdToAud falls back to null on failure, caches success", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  try {
    resetFxCache();
    globalThis.fetch = (async () => { calls++; throw new Error("offline"); }) as typeof fetch;
    assert.equal(await liveUsdToAud(), null);
    globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ date: "2026-10-13", rate: 1.53 })); }) as typeof fetch;
    const before = calls;
    assert.deepEqual(await liveUsdToAud(1000), { rate: 1.53, date: "2026-10-13" });
    assert.deepEqual(await liveUsdToAud(2000), { rate: 1.53, date: "2026-10-13" });
    assert.equal(calls - before, 1, "second call served from cache");
  } finally {
    globalThis.fetch = realFetch;
    resetFxCache();
  }
});
