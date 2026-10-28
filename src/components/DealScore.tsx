import { scoreBand, type LiveScore } from "@/lib/live-score";

const TONE: Record<string, { ring: string; text: string; bg: string }> = {
  gain: { ring: "ring-gain/60", text: "text-gain", bg: "bg-gain-soft" },
  accent: { ring: "ring-accent/60", text: "text-accent", bg: "bg-accent-soft" },
  warn: { ring: "ring-warn/60", text: "text-warn", bg: "bg-warn-soft" },
  muted: { ring: "ring-line-strong", text: "text-muted", bg: "bg-panel-2" },
};

/**
 * Deal score out of 100. Click (or tap) it to open the breakdown — what added to the score and what held it down.
 * Uses <details>, so it works without JavaScript and with the keyboard.
 */
export function DealScore({ score }: { score: LiveScore | null | undefined }) {
  if (!score) return null;
  const band = scoreBand(score.total);
  const t = TONE[band.tone];
  return (
    <details className="group relative inline-block text-left" data-testid="deal-score">
      <summary
        className={`flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full ring-2 ${t.ring} ${t.bg} ${t.text} font-mono text-sm font-semibold [&::-webkit-details-marker]:hidden`}
        aria-label={`Deal score ${score.total} out of 100 — ${band.label}. Show breakdown`}
        title="Deal score — click for the breakdown"
      >
        {score.total}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-line bg-panel p-4 text-left shadow-2xl shadow-black/60">
        <div className="mb-3 flex items-baseline justify-between">
          <span className={`font-mono text-2xl font-semibold ${t.text}`}>
            {score.total}
            <span className="text-sm text-muted">/100</span>
          </span>
          <span className={`text-xs font-medium ${t.text}`}>{band.label}</span>
        </div>
        <ul className="space-y-2.5">
          {score.factors.map((f) => {
            const pct = f.max > 0 ? Math.round((f.points / f.max) * 100) : 0;
            return (
              <li key={f.label}>
                <div className="flex justify-between text-xs">
                  <span className="text-ink">{f.label}</span>
                  <span className="font-mono text-muted">
                    {f.points}/{f.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                  <div className={`h-1.5 rounded-full ${pct >= 60 ? "bg-gain" : pct >= 30 ? "bg-warn" : "bg-loss"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{f.detail}</div>
              </li>
            );
          })}
        </ul>
        {score.caps.length > 0 && (
          <p className="mt-3 rounded-md bg-warn-soft px-2 py-1.5 text-[11px] text-warn">{score.caps.join(" · ")}</p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Built only from what CardHawk knows about this listing. It drops when the evidence is thin. A guide, not advice.
        </p>
      </div>
    </details>
  );
}
