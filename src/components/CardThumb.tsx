import type { CardIdentity } from "@/lib/types";

/**
 * Card image. Real listings (Phase 3) pass an imageUrl from eBay.
 * Demo data has no images, so we draw a neutral placeholder "slab"
 * with the player's initials — never a picture of a real card.
 */
const SPORT_HUE: Record<CardIdentity["sport"], string> = {
  NBA: "from-orange-500/30 to-orange-900/10",
  MLB: "from-sky-500/30 to-sky-900/10",
  Pokemon: "from-yellow-400/30 to-yellow-900/10",
  Other: "from-slate-500/30 to-slate-900/10",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CardThumb({
  card,
  imageUrl,
  size = "md",
}: {
  card: CardIdentity;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: "h-14 w-10", md: "h-20 w-14", lg: "h-56 w-40" }[size];
  const graded = card.grader !== "RAW";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`${card.year} ${card.set} ${card.player}`}
        className={`${dims} shrink-0 rounded-md object-cover ring-1 ring-line`}
      />
    );
  }

  return (
    <div
      className={`${dims} relative flex shrink-0 flex-col overflow-hidden rounded-md bg-panel-2 ring-1 ring-line-strong`}
      aria-label="Placeholder image (demo data has no card photo)"
    >
      {graded && (
        <div
          className={`flex items-center justify-between bg-ink/90 px-1 text-bg ${
            size === "lg" ? "py-1.5 text-xs" : "py-0.5 text-[7px]"
          }`}
        >
          <span className="font-semibold">{card.grader}</span>
          <span className="num font-bold">{card.grade}</span>
        </div>
      )}
      <div
        className={`m-1 flex flex-1 items-center justify-center rounded-sm bg-gradient-to-b ${SPORT_HUE[card.sport]}`}
      >
        <span className={`num font-semibold text-ink/80 ${size === "lg" ? "text-4xl" : "text-xs"}`}>
          {initials(card.player)}
        </span>
      </div>
      {size === "lg" && (
        <div className="px-2 pb-2 text-center text-[10px] text-faint">Demo placeholder — no photo</div>
      )}
    </div>
  );
}
