import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import { formatINR } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await pageGuard();
  const rows = await prisma.$queryRaw<{ service: string; projects: bigint; active: bigint; revenue: unknown }[]>`
    SELECT pr."projectType" AS service, COUNT(DISTINCT pr.id) AS projects,
      COUNT(DISTINCT pr.id) FILTER (WHERE pr.status NOT IN ('COMPLETED','CANCELLED')) AS active,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','REFUND_PENDING')),0) AS revenue
    FROM "Project" pr LEFT JOIN "Payment" p ON p."projectId" = pr.id GROUP BY 1 ORDER BY 4 DESC`;
  return (
    <>
      <PageHeader title="Services Management" description="Services as delivered: derived from the project types actually sold. There is no separate service catalogue table, so this view is read-only." />
      <Panel bodyClass="p-0 pb-2"><div className="pt-3">
        <DataTable rowKey={(r) => r.service} rows={rows} empty={<EmptyBlock icon="box" title="No services delivered yet" hint="Services appear once projects exist." />}
          columns={[{ key: "s", header: "Service", render: (r) => <b>{r.service}</b> }, { key: "p", header: "Projects", render: (r) => Number(r.projects) }, { key: "a", header: "Active", render: (r) => Number(r.active) }, { key: "r", header: "Settled revenue", render: (r) => formatINR(Number(r.revenue)) }]} /></div></Panel>
    </>
  );
}
