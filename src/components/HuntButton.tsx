"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import HawkLogo from "./HawkLogo";

/** A hunt usually takes 40–55 seconds (eBay searches + about one price lookup per second). */
const EXPECTED_MS = 55_000;

/** Estimated progress: climbs quickly, slows down, and waits at 95% until the hunt really finishes. */
export function huntProgress(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs / EXPECTED_MS, 0), 1);
  return Math.min(95, Math.round(95 * (1 - Math.pow(1 - t, 2))));
}

/**
 * "Hunt now" button. While the hunt runs, a full-screen hawk flaps its wings with a percentage.
 * The percentage is an estimate from elapsed time (the server doesn't report progress mid-run);
 * it jumps to 100% when the hunt is done.
 */
export default function HuntButton() {
  const { pending } = useFormStatus();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setDone(false);
      const start = Date.now();
      setPct(0);
      const id = setInterval(() => setPct(huntProgress(Date.now() - start)), 250);
      return () => clearInterval(id);
    }
    if (wasPending.current) {
      wasPending.current = false;
      setPct(100);
      setDone(true);
      const id = setTimeout(() => setDone(false), 900);
      return () => clearTimeout(id);
    }
  }, [pending]);

  const show = pending || done;
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-panel-2 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-line disabled:opacity-60"
      >
        {pending ? `Hunting… ${pct}%` : "Hunt now"}
      </button>
      {show && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/85 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="hawk-bob">
            <HawkLogo flap={!done} className="h-36 w-36 drop-shadow-[0_0_24px_rgba(34,197,94,0.35)]" />
          </div>
          <div className="mt-6 text-lg font-semibold">{done ? "Hunt complete" : "Hunting for profit…"}</div>
          <div className="num mt-1 text-4xl text-gain">{pct}%</div>
          <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-gain transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 max-w-xs text-center text-xs text-muted">
            {done ? "Loading your results…" : "Checking new eBay listings and looking up market values. This takes up to a minute — keep this page open."}
          </p>
        </div>
      )}
    </>
  );
}
