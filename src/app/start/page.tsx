import Link from "next/link";
import { quickStartAction } from "@/app/actions";
import { Flash } from "@/components/FormBits";
import { currentLimits } from "@/data/billing";
import { loadHunterConfig, loadSettings } from "@/data/db";
import { BUDGETS, CHOOSY, type Choosy } from "@/lib/quickstart";

export const metadata = { title: "CardHawk AI · Quick start" };
export const dynamic = "force-dynamic";

const SPORT_LABEL = { MLB: "Baseball", NBA: "Basketball", Pokemon: "Pokémon" } as const;

/** One short form that sets up a new account: region, what you collect, budget, how choosy. */
export default async function QuickStartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [{ settings }, hunter, limits] = await Promise.all([loadSettings(), loadHunterConfig(), currentLimits()]);
  const region = settings.buyerRegion === "US" ? "US" : "AU";
  const cur = region === "AU" ? "A$" : "US$";
  const pill = "flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm has-[:checked]:border-gain has-[:checked]:bg-gain-soft has-[:checked]:text-gain";
  const step = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gain-soft font-mono text-sm font-semibold text-gain";
  const defaultChoosy: Choosy = settings.minRoiPercent >= 25 ? "strict" : settings.minRoiPercent <= 8 ? "more" : "balanced";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Quick start</h1>
      <p className="mt-1 text-sm text-muted">
        Three questions and CardHawk starts hunting for you. You can fine-tune everything later in Settings
        {limits.hunter ? " and Profit Hunter" : " and the Automatic Scanner"}.
      </p>
      <div className="mt-4"><Flash error={error} /></div>

      <form action={quickStartAction} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3"><span className={step}>1</span><h2 className="font-semibold">Where do you buy from?</h2></div>
          <p className="mt-1 pl-10 text-xs text-faint">Sets shipping quotes, tax on purchases and the currency you see.</p>
          <div className="mt-3 grid gap-2 pl-10 sm:grid-cols-2">
            <label className={pill}><input type="radio" name="region" value="AU" defaultChecked={region === "AU"} className="accent-gain" /> 🇦🇺 Australia</label>
            <label className={pill}><input type="radio" name="region" value="US" defaultChecked={region === "US"} className="accent-gain" /> 🇺🇸 United States</label>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3"><span className={step}>2</span><h2 className="font-semibold">What do you collect?</h2></div>
          <p className="mt-1 pl-10 text-xs text-faint">Tick any. CardHawk only looks at these.</p>
          <div className="mt-3 grid gap-2 pl-10 sm:grid-cols-3">
            {(["MLB", "NBA", "Pokemon"] as const).map((s) => (
              <label key={s} className={pill}>
                <input type="checkbox" name={`s_${s}`} defaultChecked={hunter.config.sports.includes(s)} className="accent-gain" /> {SPORT_LABEL[s]}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3"><span className={step}>3</span><h2 className="font-semibold">Your budget and how choosy to be</h2></div>
          <p className="mt-1 pl-10 text-xs text-faint">The most you&apos;d pay for one card, and how good a deal has to be before you hear about it.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 pl-10 sm:grid-cols-4">
            {BUDGETS.map((b, i) => (
              <label key={b} className={`${pill} justify-center`}>
                <input type="radio" name="budget" value={b} defaultChecked={i === 1} className="sr-only" /> up to {cur}{b.toLocaleString("en-AU")}
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 pl-10">
            {(Object.keys(CHOOSY) as Choosy[]).map((k) => (
              <label key={k} className={`${pill} items-start`}>
                <input type="radio" name="choosy" value={k} defaultChecked={k === defaultChoosy} className="mt-0.5 accent-gain" />
                <span><span className="block font-medium">{CHOOSY[k].label}</span><span className="block text-xs text-faint">{CHOOSY[k].hint}</span></span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button className="rounded-xl bg-gain px-6 py-3 text-sm font-semibold text-bg hover:bg-gain/90" data-testid="quickstart-submit">
            {limits.hunter ? "Start hunting" : "Create my searches"}
          </button>
          <Link href="/" className="text-sm text-muted hover:text-ink">Skip for now</Link>
        </div>
        <p className="text-xs text-faint">
          {limits.hunter
            ? "This switches on the Profit Hunter, which checks new eBay listings every 10 minutes and emails you when one clears your rules."
            : "This saves one starter search per pick (PSA 10s under your budget), checked automatically."}{" "}
          Every purchase happens on eBay.
        </p>
      </form>
    </div>
  );
}
