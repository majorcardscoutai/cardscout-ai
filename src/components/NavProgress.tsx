"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import HawkLogo from "./HawkLogo";
import { linkStartsLoad, navProgress } from "@/lib/nav-progress";

const SHOW_AFTER_MS = 250; // quick pages never flash the loader
const GIVE_UP_MS = 60_000;

/** Full-screen hawk with a percentage while a page or form is loading. Mounted once in the layout. */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [start, setStart] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const first = useRef(true);
  const active = useRef(false);

  const begin = () => {
    active.current = true;
    setDone(false);
    setPct(0);
    setStart(Date.now());
  };
  const finish = () => {
    if (!active.current) return;
    active.current = false;
    setStart(null);
    setPct(100);
    setDone(true);
    setTimeout(() => {
      setVisible(false);
      setDone(false);
    }, 350);
  };

  // Start on internal link clicks and form submits.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const ok = linkStartsLoad(
        { href: a.getAttribute("href") ?? "", target: a.getAttribute("target") ?? "", hasDownload: a.hasAttribute("download"), noProgress: !!a.closest("[data-no-progress]") },
        { origin: location.origin, pathname: location.pathname, search: location.search },
      );
      if (ok) begin();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || e.defaultPrevented || form.closest("[data-no-progress]") || (form.target && form.target !== "_self")) return;
      begin();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit as EventListener, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit as EventListener, true);
    };
  }, []);

  // Tick the percentage; show only if loading takes a moment; finish when the page settles.
  useEffect(() => {
    if (start === null) return;
    const tick = setInterval(() => setPct(navProgress(Date.now() - start)), 120);
    const show = setTimeout(() => active.current && setVisible(true), SHOW_AFTER_MS);
    const giveUp = setTimeout(finish, GIVE_UP_MS);
    // A form that stays on the same address (e.g. "Save" on the same page) is done once the page updates and settles.
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => {
      if (Date.now() - start < 400) return;
      clearTimeout(quiet);
      quiet = setTimeout(finish, 400);
    });
    obs.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
    return () => {
      clearInterval(tick);
      clearTimeout(show);
      clearTimeout(giveUp);
      clearTimeout(quiet);
      obs.disconnect();
    };
  }, [start]);

  // The address changed: the new page has arrived.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [pathname, search]);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg/75 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="hawk-bob">
        <HawkLogo flap={!done} className="h-24 w-24 drop-shadow-[0_0_24px_rgba(34,197,94,0.35)]" />
      </div>
      <div className="mt-4 text-sm font-semibold">{done ? "Ready" : "Loading…"}</div>
      <div className="num mt-1 text-3xl text-gain">{pct}%</div>
      <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-gain transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
