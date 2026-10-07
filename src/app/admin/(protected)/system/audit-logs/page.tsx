import { pageGuard } from "@/lib/admin/guard";
import { first, parsePage, type SP } from "@/lib/admin/paging";
import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  return (<><PageHeader title="Audit Logs" description="Append-only record of platform, tenant, security and administrative events — including failed and blocked attempts." /><AuditTable base="/admin/system/audit-logs" sp={sp} page={parsePage(first(sp.page))} /></>);
}
