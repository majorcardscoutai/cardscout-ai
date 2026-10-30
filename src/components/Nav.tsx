"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import { logout } from "@/app/login/actions";
import { badge, initialsFromEmail, type NavCounts } from "@/lib/nav";
import HawkLogo from "@/components/HawkLogo";
import {
  IconBriefcase,
  IconEye,
  IconOverview,
  IconRadar,
  IconSearch,
  IconSettings,
  IconTag,
  IconTarget,
  IconTrophy,
} from "./Icons";

type Item = { href: string; label: string; short?: string; Icon: typeof IconOverview; count?: "topDeals" | "hunterDeals" | "savedSearches" | "watchlist"; hot?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Deals",
    items: [
      { href: "/", label: "Overview", Icon: IconOverview },
      { href: "/deals", label: "Top Deals", Icon: IconTrophy, count: "topDeals", hot: true },
      { href: "/hunter", label: "Profit Hunter", short: "Hunter", Icon: IconTarget, count: "hunterDeals", hot: true },
    ],
  },
  {
    title: "Find",
    items: [
      { href: "/scanner", label: "Automatic Scanner", short: "Auto Scan", Icon: IconRadar, count: "savedSearches" },
      { href: "/analyse", label: "Manual Scanner", short: "Analyse", Icon: IconSearch },
    ],
  },
  {
    title: "My cards",
    items: [
      { href: "/watchlist", label: "Watchlist", Icon: IconEye, count: "watchlist" },
      { href: "/values", label: "Card Values", short: "Values", Icon: IconTag },
      { href: "/portfolio", label: "Portfolio", Icon: IconBriefcase },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", Icon: IconSettings },
      { href: "/billing", label: "Plan & billing", short: "Plan", Icon: IconTag },
    ],
  },
];

const ADMIN: Item = { href: "/admin", label: "Admin", Icon: IconSettings };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <HawkLogo framed className="h-10 w-10 shrink-0" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">CardHawk AI</div>
        <div className="text-[11px] text-faint">Private deal desk</div>
      </div>
    </div>
  );
}

/** Number badge beside a menu item — streamed in, so the menu never waits for it. */
function Count({ counts, k, hot, small = false }: { counts: Promise<NavCounts | null>; k: NonNullable<Item["count"]>; hot?: boolean; small?: boolean }) {
  const c = use(counts);
  const b = badge(c?.[k]);
  if (!b) return null;
  return (
    <span
      className={`num shrink-0 rounded-full ${small ? "px-1.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${hot ? "bg-gain-soft text-gain" : "bg-panel-2 text-muted"}`}
      data-testid={`nav-count-${k}`}
    >
      {b}
    </span>
  );
}

const PILL = { gain: ["bg-gain-soft text-gain", "bg-gain"], warn: ["bg-warn-soft text-warn", "bg-warn"], muted: ["bg-panel-2 text-muted", "bg-faint"] } as const;

function HunterPill({ counts }: { counts: Promise<NavCounts | null> }) {
  const c = use(counts);
  if (!c) return null;
  const [cls, dot] = PILL[c.hunter.tone];
  return (
    <Link href="/hunter" className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] ${cls}`} data-testid="nav-hunter-status">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot} ${c.hunter.tone === "gain" ? "animate-pulse" : ""}`} />
      {c.hunter.text}
    </Link>
  );
}

export default function Nav({
  admin = false,
  email,
  counts,
  showBilling = false,
}: {
  admin?: boolean;
  email?: string;
  counts?: Promise<NavCounts | null>;
  /** Plan & billing: admins only until billing is switched on (BILLING_REQUIRED=1). */
  showBilling?: boolean;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/auth/") || pathname === "/terms" || pathname === "/privacy") return null;
  const groups = GROUPS.map((g) => {
    if (g.title !== "Account") return g;
    const items = g.items.filter((i) => i.href !== "/billing" || showBilling);
    return { ...g, items: admin ? [...items, ADMIN] : items };
  });
  const flat = groups.flatMap((g) => g.items);

  return (
    <>
      {/* Desktop sidebar — grouped */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-line bg-panel px-3.5 py-5 md:flex">
        <div className="px-1.5">
          <Logo />
        </div>
        <nav aria-label="Main menu" className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <span className="px-2.5 pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{g.title}</span>
              {g.items.map(({ href, label, count, hot }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
                      active ? "bg-panel-2 text-ink ring-1 ring-line-strong" : "text-muted hover:bg-panel-2 hover:text-ink"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
                    <span className="flex-1">{label}</span>
                    {count && counts && (
                      <Suspense fallback={null}>
                        <Count counts={counts} k={count} hot={hot} />
                      </Suspense>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5">
          <p className="px-1.5 text-xs leading-relaxed text-faint">
            Values from{" "}
            <a href="https://www.sportscardspro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">SportsCardsPro</a> and{" "}
            <a href="https://www.pricecharting.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">PriceCharting</a>. Your own Card Values always win.
          </p>
          {counts && (
            <Suspense fallback={null}>
              <HunterPill counts={counts} />
            </Suspense>
          )}
          {email && (
            <div className="flex items-center gap-2.5 rounded-lg border border-line bg-bg/40 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">
                {initialsFromEmail(email)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-medium" title={email}>{email}</div>
                <div className="text-xs text-faint">{admin ? "Admin" : "Member"}</div>
              </div>
              <form action={logout}>
                <button className="text-xs text-faint hover:text-ink">Sign out</button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile header + scrollable tab strip */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <Logo />
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
            Private
          </span>
        </div>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
          {flat.map(({ href, label, short, Icon, count, hot }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                  active ? "bg-ink text-bg" : "bg-panel-2 text-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {short ?? label}
                {hot && count && counts && (
                  <Suspense fallback={null}>
                    <Count counts={counts} k={count} hot small />
                  </Suspense>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
