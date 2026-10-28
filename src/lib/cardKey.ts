/**
 * A "card key" identifies one exact card for the value book:
 * category + player + year + set + card number + parallel + print run + variation + grader + grade.
 *
 * Normalised so small spelling differences don't matter
 * ("2018 Topps Update" = "Topps Update", "#US1" = "us1", "Dončić" = "Doncic"),
 * but anything that changes the value (parallel, grade, print run) must match exactly.
 * Returns null if a field that matters is missing — we never guess a match.
 */
import type { CardIdentity } from "./types";

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normSet(set: string, year: number | undefined): string {
  let s = norm(set);
  // Drop a leading year or season ("2018", "2018 19") — the year is already in the key.
  s = s.replace(/^(19|20)\d\d( \d\d)? /, "");
  if (year) s = s.replace(new RegExp(`^${year} `), "");
  return s;
}

function normParallel(p: string | null | undefined): string {
  const n = norm(p);
  return n === "base" || n === "none" ? "" : n;
}

export function cardKey(card: Partial<CardIdentity>): string | null {
  const { sport, player, year, set, cardNumber, grader } = card;
  // Pokémon titles often skip the year, and the price guide identifies Pokémon cards by set + number.
  if (!sport || !player || (!year && sport !== "Pokemon") || !set || !cardNumber || !grader) return null;
  // Non-English cards are different products with different prices — never matched to English ones.
  if (card.language) return null;
  if (grader !== "RAW" && (card.grade === undefined || card.grade === null)) return null;
  return [
    sport.toLowerCase(),
    norm(player),
    year ? String(year) : "",
    normSet(set, year),
    norm(cardNumber.replace(/^#/, "")).replace(/ /g, ""),
    normParallel(card.parallel),
    card.serialNumbered ? String(card.serialNumbered) : "",
    norm(card.variation),
    grader.toLowerCase(),
    grader === "RAW" ? "" : String(card.grade),
  ].join("|");
}
