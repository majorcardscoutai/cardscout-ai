"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Aspect } from "@/lib/ebay/parse";
import type { CardIdentity } from "@/lib/types";

const MAX_ROUNDS = 12;

/**
 * Live search: keeps looking up market values for the cards on screen after the page has loaded,
 * then refreshes the results so the new values (and profit) appear. Stops when nothing is left,
 * nothing more can be found, or after about two minutes.
 */
export function LiveValueFiller({
  cards,
  setless,
  initialPending,
  sport,
}: {
  sport?: "Pokemon";
  cards: { key: string; card: CardIdentity }[];
  setless: { title: string; aspects: Aspect[] }[];
  initialPending: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<{ left: number; found: number; done: boolean; error: string | null }>({
    left: initialPending,
    found: 0,
    done: initialPending === 0 && setless.length === 0,
    error: null,
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current || state.done) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      let found = 0;
      let shownFound = 0;
      let stalls = 0;
      for (let round = 0; round < MAX_ROUNDS && !cancelled; round++) {
        let r: { pending?: number; matched?: number; looked?: number; error?: string | null };
        try {
          const res = await fetch("/api/live-values", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Titles without a usable card reading go every round: sealed products are looked up from them too.
            body: JSON.stringify({ cards, setless, sport, round }),
          });
          r = await res.json();
          if (!res.ok) throw new Error(r.error ?? `HTTP ${res.status}`);
        } catch (e) {
          if (!cancelled) setState((s) => ({ ...s, done: true, error: e instanceof Error ? e.message : "Couldn't reach CardHawk." }));
          return;
        }
        if (cancelled) return;
        found += r.matched ?? 0;
        const left = r.pending ?? 0;
        setState({ left, found, done: false, error: r.error ?? null });
        // Show new values every few rounds, and at the end.
        if (found > shownFound && (left === 0 || round % 3 === 2)) {
          shownFound = found;
          router.refresh();
        }
        if (r.error || left === 0) break;
        stalls = (r.looked ?? 0) === 0 ? stalls + 1 : 0;
        if (stalls >= 2) break;
      }
      if (!cancelled) {
        if (found > shownFound) router.refresh();
        setState((s) => ({ ...s, done: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per search result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.error) return <p className="mb-3 text-xs text-warn">Market values: {state.error}</p>;
  if (state.done) return state.found > 0 ? <p className="mb-3 text-xs text-muted">Found {state.found} more market value{state.found === 1 ? "" : "s"}.</p> : null;
  return (
    <p className="mb-3 flex items-center gap-2 text-xs text-accent" data-testid="live-value-filler">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
      Finding market values{state.left > 0 ? ` — ${state.left} card${state.left === 1 ? "" : "s"} left` : "…"}
      {state.found > 0 ? ` · ${state.found} found so far` : ""}
    </p>
  );
}
