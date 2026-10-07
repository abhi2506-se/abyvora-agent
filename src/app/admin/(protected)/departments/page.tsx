import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import { NewDepartmentButton } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  await pageGuard();
  const rows = await prisma.department.findMany({ orderBy: [{ organizationId: "asc" }, { name: "asc" }], take: 500, select: { id: true, name: true, createdAt: true, organization: { select: { id: true, name: true } }, _count: { select: { members: true } } } });
  return (
    <>
      <PageHeader title="Departments" description="ABYVORA-internal and organization departments." actions={<NewDepartmentButton />} />
      <Panel bodyClass="p-0 pb-2"><div className="pt-3">
        <DataTable rowKey={(d) => d.id} rows={rows} empty={<EmptyBlock icon="building" title="No departments yet" hint="Create one with “+ New department”." />}
          columns={[
            { key: "n", header: "Department", render: (d) => <span className="font-semibold">{d.name}</span> },
            { key: "o", header: "Scope", render: (d) => d.organization ? <Link href={`/admin/organizations/${d.organization.id}`} className="hover:underline">{d.organization.name}</Link> : "ABYVORA internal" },
            { key: "m", header: "Members", render: (d) => d._count.members }, { key: "c", header: "Created", render: (d) => d.createdAt.toLocaleDateString("en-IN") },
          ]} /></div></Panel>
    </>
  );
}
