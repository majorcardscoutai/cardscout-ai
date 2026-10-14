/**
 * "Exclude words" for searches: hide listings whose title contains any of them
 * (e.g. lot, reprint, custom, digital). Whole words only, case and accents ignored,
 * so "rp" won't hide "Sharp" and "lot" won't hide "Lottery".
 */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "lot, reprint  custom" → ["lot", "reprint", "custom"] (max 20 words, de-duplicated). */
export function parseExcludeWords(raw: string | null | undefined): string[] {
  const words = plain(raw ?? "")
    .split(/[\s,;]+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((w) => w.length > 0 && w.length <= 30);
  return [...new Set(words)].slice(0, 20);
}

export function excludeWordsText(words: string[]): string {
  return words.join(", ");
}

/** Returns the first exclude word found in the title, or null. */
export function excludedBy(title: string, words: string[]): string | null {
  if (words.length === 0) return null;
  const t = plain(title);
  for (const w of words) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(t)) return w;
  }
  return null;
}
