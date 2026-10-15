// Small presentational building blocks shared across pages.
import type { ReactNode } from "react";
import { formatMoney, formatPercent } from "@/lib/currency";
import type { Confidence } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";
import { IconAlert } from "./Icons";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
  right,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-relaxed">
        <strong className="font-semibold">Demonstration data.</strong>{" "}
        {children ??
          "Every listing, price and sold comparison on this page is made up for testing the layout. None of these are live opportunities."}
      </p>
    </div>
  );
}

/** Shows a USD amount with its AUD equivalent underneath. */
export function Money({
  usd,
  fx,
  tone = "neutral",
  size = "md",
  align = "left",
}: {
  usd: number | null | undefined;
  /** USD→AUD rate for the A$ line; 0 = show US$ only (buyers outside Australia). */
  fx: number;
  tone?: "neutral" | "auto";
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
}) {
  if (usd === null || usd === undefined) {
    return <span className="text-sm text-faint">Missing</span>;
  }
  const color =
    tone === "auto" ? (usd > 0 ? "text-gain" : usd < 0 ? "text-loss" : "text-ink") : "text-ink";
  const main = { sm: "text-sm", md: "text-[15px]", lg: "text-2xl" }[size];
  return (
    <span className={`inline-flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <span className={`num font-medium ${main} ${color}`}>
        {usd > 0 && tone === "auto" ? "+" : ""}
        {formatMoney(usd, "USD")}
      </span>
      {fx > 0 && <span className="num text-[11px] text-faint">{formatMoney(usd * fx, "AUD")}</span>}
    </span>
  );
}

export function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-sm text-faint">—</span>;
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink";
  return (
    <span className={`num text-sm font-medium ${color}`}>
      {value > 0 ? "+" : ""}
      {formatPercent(value)}
    </span>
  );
}

export function ScoreBadge({ score, size = "md" }: { score: number | null; size?: "md" | "lg" }) {
  const tone =
    score === null
      ? "bg-panel-2 text-faint ring-line-strong"
      : score >= 80
        ? "bg-gain-soft text-gain ring-gain/40"
        : score >= 65
          ? "bg-accent-soft text-accent ring-accent/40"
          : score >= 50
            ? "bg-warn-soft text-warn ring-warn/40"
            : "bg-loss-soft text-loss ring-loss/40";
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm";
  return (
    <div
      className={`num grid shrink-0 place-items-center rounded-full font-semibold ring-1 ${tone} ${dims}`}
      title={scoreLabel(score)}
    >
      {score ?? "—"}
    </div>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const map: Record<Confidence, [string, string]> = {
    high: ["High confidence", "text-gain border-gain/30 bg-gain-soft"],
    medium: ["Medium confidence", "text-accent border-accent/30 bg-accent-soft"],
    low: ["Low confidence", "text-warn border-warn/30 bg-warn-soft"],
    none: ["Insufficient data", "text-loss border-loss/30 bg-loss-soft"],
  };
  const [label, cls] = map[confidence];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-panel-2 text-muted ring-1 ring-line"
      }`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "gain" | "loss" | "warn";
}) {
  const color = { neutral: "text-ink", gain: "text-gain", loss: "text-loss", warn: "text-warn" }[tone];
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-2 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ok" | "off" | "demo";
  detail: string;
}) {
  const dot = { ok: "bg-gain", off: "bg-loss", demo: "bg-warn" }[status];
  const text = { ok: "Connected", off: "Not connected", demo: "Demo data" }[status];
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-xs text-faint">{detail}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {text}
      </span>
    </div>
  );
}
