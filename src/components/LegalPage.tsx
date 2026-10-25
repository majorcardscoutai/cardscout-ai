import type { ReactNode } from "react";
import HawkLogo from "@/components/HawkLogo";
import { LEGAL_UPDATED } from "@/lib/legal";

/** Full-screen reading layout for the Terms of Use and Privacy Policy (public pages, no menu). */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-4 py-10">
      <article className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-panel p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-2.5">
          <HawkLogo framed className="h-10 w-10 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="text-xs text-faint">CardHawk AI · last updated {LEGAL_UPDATED}</div>
          </div>
        </div>
        <div className="space-y-5 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
          {children}
        </div>
        <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-4 text-xs">
          <a href="/" className="text-accent hover:underline">Back to CardHawk</a>
          <a href="/terms" className="text-accent hover:underline">Terms of Use</a>
          <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>
        </div>
      </article>
    </div>
  );
}
