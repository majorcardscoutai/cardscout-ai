/**
 * Who CardHawk's Terms of Use and Privacy Policy name (set in Vercel → Environment Variables).
 * Until they're set, the pages show a clear [placeholder] so nothing invented goes live.
 * The documents are a starting draft — have a lawyer review them before charging for CardHawk.
 */
export const LEGAL_UPDATED = "26 October 2026";

export interface LegalDetails {
  entity: string; // e.g. "Travis Major trading as CardHawk AI" or "CardHawk Pty Ltd"
  abn: string | null; // shown when set
  email: string; // contact for privacy and legal questions
  state: string; // governing law
  missing: string[]; // env vars still to set (shown to admins)
}

export function legalDetails(): LegalDetails {
  const missing: string[] = [];
  const get = (name: string, placeholder: string) => {
    const v = (process.env[name] ?? "").trim();
    if (!v) missing.push(name);
    return v || placeholder;
  };
  return {
    entity: get("LEGAL_ENTITY", "[business name]"),
    abn: (process.env.LEGAL_ABN ?? "").trim() || null,
    email: get("LEGAL_EMAIL", "[contact email]"),
    state: (process.env.LEGAL_STATE ?? "").trim() || "New South Wales",
    missing,
  };
}
