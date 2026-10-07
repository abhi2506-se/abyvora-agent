import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import { NewTeamButton } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  await pageGuard();
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, organizationId: true, departmentId: true, _count: { select: { members: true } } } });
  const [orgs, depts] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: teams.map((t) => t.organizationId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { id: { in: teams.map((t) => t.departmentId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const o = new Map(orgs.map((x) => [x.id, x.name])), d = new Map(depts.map((x) => [x.id, x.name]));
  return (
    <>
      <PageHeader title="Teams" description="Teams group users inside a department." actions={<NewTeamButton />} />
      <Panel bodyClass="p-0 pb-2"><div className="pt-3">
        <DataTable rowKey={(t) => t.id} rows={teams} empty={<EmptyBlock icon="users" title="No teams yet" hint="Create one with “+ New team”." />}
          columns={[
            { key: "n", header: "Team", render: (t) => <span className="font-semibold">{t.name}</span> },
            { key: "d", header: "Department", render: (t) => (t.departmentId ? d.get(t.departmentId) ?? "—" : "—") },
            { key: "o", header: "Scope", render: (t) => (t.organizationId ? <Link href={`/admin/organizations/${t.organizationId}`} className="hover:underline">{o.get(t.organizationId) ?? "Organization"}</Link> : "ABYVORA internal") },
            { key: "m", header: "Members", render: (t) => t._count.members },
          ]} /></div></Panel>
    </>
  );
}
