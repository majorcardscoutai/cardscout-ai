"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBriefcase,
  IconEye,
  IconOverview,
  IconRadar,
  IconSearch,
  IconSettings,
  IconTag,
  IconTrophy,
} from "./Icons";

const NAV = [
  { href: "/", label: "Overview", Icon: IconOverview },
  { href: "/scanner", label: "Automatic Scanner", short: "Auto Scan", Icon: IconRadar },
  { href: "/analyse", label: "Manual Scanner", short: "Analyse", Icon: IconSearch },
  { href: "/deals", label: "Top Deals", Icon: IconTrophy },
  { href: "/watchlist", label: "Watchlist", Icon: IconEye },
  { href: "/values", label: "Card Values", short: "Values", Icon: IconTag },
  { href: "/portfolio", label: "Portfolio", Icon: IconBriefcase },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gain/15 ring-1 ring-gain/40">
        <span className="num text-sm font-bold text-gain">CS</span>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">CardScout AI</div>
        <div className="text-[11px] text-faint">Private deal desk</div>
      </div>
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-panel px-4 py-6 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-panel-2 text-ink ring-1 ring-line-strong"
                    : "text-muted hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-gain" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-warn/30 bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
          Phase 4 · Saved searches are scanned against your Card Values. Top Deals are still demo data until sold prices are connected.
        </div>
      </aside>

      {/* Mobile header + scrollable tab strip */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <Logo />
          <span className="rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn">
            Demo
          </span>
        </div>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
          {NAV.map(({ href, label, short, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                  active ? "bg-ink text-bg" : "bg-panel-2 text-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {short ?? label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
