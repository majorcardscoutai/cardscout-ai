import { DbError, Flash } from "@/components/FormBits";
import ManualAnalysis from "@/components/ManualAnalysis";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { loadSettings } from "@/data/source";

export const dynamic = "force-dynamic";

export default async function ManualScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { settings, error: dbError } = await loadSettings();

  return (
    <>
      <PageHeader
        title="Manual Scanner"
        subtitle="Enter a card's exact details and prices to check the profit, then save it to your watchlist."
      />
      <Flash saved={saved} error={error} />
      <DbError error={dbError} />

      <Panel title="Analyse a card" className="mb-6" right={<Tag>Working · Phase 2</Tag>}>
        <ManualAnalysis settings={settings} />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Paste an eBay listing URL" right={<Tag tone="warn">Phase 3</Tag>}>
          <p className="text-xs leading-relaxed text-faint">
            Will read the listing's details automatically once eBay developer access is approved. For now, paste the
            link into the form above so it's saved with the card.
          </p>
        </Panel>
        <Panel title="Upload a card photo" right={<Tag tone="warn">Phase 5</Tag>}>
          <p className="text-xs leading-relaxed text-faint">
            AI image analysis will suggest the card identity for you to confirm. It never replaces checking the set,
            number and parallel yourself.
          </p>
        </Panel>
      </div>
    </>
  );
}
