import { NextResponse } from "next/server";
import { cardValueMap } from "@/data/db";
import { fillProviderValues, resolveSetless } from "@/data/provider";
import { currentViewer } from "@/data/session";
import { cardKey } from "@/lib/cardKey";
import type { Aspect } from "@/lib/ebay/parse";
import { providerConfigured } from "@/lib/provider-client";
import type { CardIdentity } from "@/lib/types";

/**
 * Live search, after the page has loaded: keep looking up market values for the cards on screen, a few
 * seconds at a time (the price guide allows about one lookup per second). The page calls this again until
 * nothing is left, then refreshes to show the new values. Values are cached for everyone, as usual.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STEP_MS = 9_000;
const MAX_CARDS = 80;
const SPORTS = new Set(["NBA", "MLB", "Pokemon"]);

interface Body {
  cards?: { key?: unknown; card?: unknown }[];
  setless?: { title?: unknown; aspects?: unknown }[];
}

function asCard(raw: unknown, key: unknown): { key: string; card: CardIdentity } | null {
  if (!raw || typeof raw !== "object" || typeof key !== "string" || key.length > 400) return null;
  const card = raw as CardIdentity;
  if (!SPORTS.has(card.sport)) return null;
  // The key must be the card's own key — nothing else can be looked up or saved through here.
  return cardKey(card) === key ? { key, card } : null;
}

function asAspects(raw: unknown): Aspect[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Aspect => !!a && typeof a === "object" && typeof (a as Aspect).name === "string" && typeof (a as Aspect).value === "string")
    .slice(0, 40)
    .map((a) => ({ name: a.name.slice(0, 80), value: a.value.slice(0, 200) }));
}

export async function POST(req: Request) {
  if (!(await currentViewer())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!providerConfigured()) return NextResponse.json({ pending: 0, matched: 0, looked: 0, error: null });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, MAX_CARDS).map((c) => asCard(c?.card, c?.key)).filter((c) => c !== null);
  const setless = (Array.isArray(body.setless) ? body.setless : [])
    .slice(0, MAX_CARDS)
    .filter((s) => typeof s?.title === "string" && s.title.length <= 300)
    .map((s) => ({ title: s.title as string, aspects: asAspects(s.aspects) }));

  const deadline = Date.now() + STEP_MS;
  const values = await cardValueMap();
  const mine = new Set([...values.map.values()].filter((v) => (v.source ?? "you") === "you").map((v) => v.key));
  let matched = 0;
  // Titles with a set CardHawk doesn't know: let the guide confirm player + set (cached for the page).
  if (setless.length > 0) {
    const sr = await resolveSetless(setless, {}, mine, Math.min(deadline, Date.now() + STEP_MS / 2));
    matched += sr.newValues.size;
  }
  const f = await fillProviderValues(cards, mine, deadline);
  matched += f.matched;
  return NextResponse.json({ pending: f.pending, looked: f.looked, matched, error: f.error });
}
