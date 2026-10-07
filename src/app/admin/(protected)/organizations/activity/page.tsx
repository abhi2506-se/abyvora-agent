import { pageGuard } from "@/lib/admin/guard";
import { first, parsePage, type SP } from "@/lib/admin/paging";
import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function OrgActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Organization Activity" description="Tenant-scoped lifecycle, subscription and security events from the audit log." />
      <AuditTable base="/admin/organizations/activity" sp={sp} page={parsePage(first(sp.page))} filters={{ onlyOrganizations: true }} />
    </>
  );
}
