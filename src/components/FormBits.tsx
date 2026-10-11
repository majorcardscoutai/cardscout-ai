// Shared form inputs. No state, so they work in server and client components.
import type { ChangeEvent, ReactNode } from "react";
import type { CardIdentity } from "@/lib/types";
import { IconAlert, IconCheck } from "./Icons";

export const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ children, tone = "gain" }: { children: ReactNode; tone?: "gain" | "neutral" }) {
  return (
    <button
      type="submit"
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        tone === "gain" ? "bg-gain text-bg hover:bg-gain/90" : "bg-panel-2 text-ink ring-1 ring-line-strong hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

/** Success / error message passed back in the URL after a form submit. */
export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) {
    return (
      <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  if (saved) {
    return (
      <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-gain/30 bg-gain-soft px-4 py-3 text-sm text-gain">
        <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{saved}</span>
      </div>
    );
  }
  return null;
}

export function DbError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
      <strong className="font-semibold">Database problem:</strong> {error}
      <span className="mt-1 block text-xs text-loss/80">
        Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local, then restart with npm run dev.
      </span>
    </div>
  );
}

/** Card identity inputs, shared by the Manual Scanner, Portfolio and edit forms. */
export function CardFields({ card }: { card?: Partial<CardIdentity> }) {
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Category">
        <select name="sport" defaultValue={card?.sport ?? "MLB"} className={inputCls}>
          <option value="MLB">MLB</option>
          <option value="NBA">NBA</option>
          <option value="Pokemon">Pokémon</option>
          <option value="Other">Other</option>
        </select>
      </Field>
      <Field label="Player / Pokémon" className="col-span-1 sm:col-span-3">
        <input name="player" required defaultValue={v(card?.player)} placeholder="Shohei Ohtani" className={inputCls} />
      </Field>
      <Field label="Year">
        <input name="year" required inputMode="numeric" defaultValue={v(card?.year)} placeholder="2018" className={inputCls} />
      </Field>
      <Field label="Set" className="col-span-1 sm:col-span-2">
        <input name="set" required defaultValue={v(card?.set)} placeholder="Topps Chrome" className={inputCls} />
      </Field>
      <Field label="Card number">
        <input name="cardNumber" required defaultValue={v(card?.cardNumber)} placeholder="150" className={inputCls} />
      </Field>
      <Field label="Parallel" hint="Blank = base card">
        <input name="parallel" defaultValue={v(card?.parallel)} placeholder="Refractor" className={inputCls} />
      </Field>
      <Field label="Serial numbered" hint="Print run, e.g. 99">
        <input name="serialNumbered" inputMode="numeric" defaultValue={v(card?.serialNumbered)} placeholder="—" className={inputCls} />
      </Field>
      <Field label="Variation">
        <input name="variation" defaultValue={v(card?.variation)} placeholder="—" className={inputCls} />
      </Field>
      <label className="flex items-end gap-2 pb-2 text-sm text-muted">
        <input type="checkbox" name="isRookie" defaultChecked={card?.isRookie ?? false} className="h-4 w-4 accent-gain" /> Rookie card
      </label>
      <Field label="Grading company">
        <select name="grader" defaultValue={card?.grader ?? "PSA"} className={inputCls}>
          <option value="PSA">PSA</option>
          <option value="BGS">BGS</option>
          <option value="SGC">SGC</option>
          <option value="CGC">CGC</option>
          <option value="RAW">Raw (ungraded)</option>
        </select>
      </Field>
      <Field label="Grade" hint="Leave blank if raw">
        <input name="grade" inputMode="decimal" defaultValue={v(card?.grade)} placeholder="10" className={inputCls} />
      </Field>
    </div>
  );
}

export function CurrencyPicker({
  value,
  onChange,
  defaultValue = "AUD",
}: {
  value?: "USD" | "AUD";
  onChange?: (c: "USD" | "AUD") => void;
  defaultValue?: "USD" | "AUD";
}) {
  return (
    <Field label="Prices entered in">
      <select
        name="currency"
        className={inputCls}
        {...(onChange
          ? { value, onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as "USD" | "AUD") }
          : { defaultValue })}
      >
        <option value="AUD">AUD (A$)</option>
        <option value="USD">USD (US$)</option>
      </select>
    </Field>
  );
}
