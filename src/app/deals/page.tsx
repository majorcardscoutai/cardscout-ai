import DealsTable from "@/components/DealsTable";
import { DemoBanner, PageHeader } from "@/components/ui";
import { getAssessments, getSettings } from "@/data/source";
import { toDealRow } from "@/lib/rows";

export const dynamic = "force-dynamic";

export default async function TopDealsPage() {
  const settings = await getSettings();
  const fx = settings.usdToAud;
  const rows = getAssessments(settings).map(toDealRow);

  return (
    <>
      <PageHeader
        title="Top Deals"
        subtitle="Ranked by investment score. Open a card to see the sold comparisons and the maths behind every number."
      />
      <DemoBanner />
      <DealsTable rows={rows} fx={fx} />
    </>
  );
}
