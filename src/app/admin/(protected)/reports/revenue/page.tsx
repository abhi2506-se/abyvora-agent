import { pageGuard } from "@/lib/admin/guard";
import { ReportView } from "@/components/admin/report-view";
import { first, type SP } from "@/lib/admin/paging";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  return <ReportView type="revenue" sp={sp} base="/admin/reports/revenue" group={first(sp.group)} />;
}
