import { pageGuard } from "@/lib/admin/guard";
import { ReportView } from "@/components/admin/report-view";
import { first, type SP } from "@/lib/admin/paging";

export const dynamic = "force-dynamic";
export default async function FinancialReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  return <ReportView type="financial" sp={await searchParams} base="/admin/revenue/reports" group={first((await searchParams).group)} />;
}
