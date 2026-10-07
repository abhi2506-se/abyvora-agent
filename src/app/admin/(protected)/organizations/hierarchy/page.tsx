import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function OrgHierarchyPage() {
  await pageGuard();
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" }, take: 200,
    select: { id: true, name: true, _count: { select: { users: true } }, departments: { select: { id: true, name: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } } },
  });
  const teams = await prisma.team.findMany({ where: { organizationId: { in: orgs.map((o) => o.id) } }, select: { id: true, name: true, departmentId: true, organizationId: true, _count: { select: { members: true } } } });
  return (
    <>
      <PageHeader title="Organization Hierarchy" description="Each organization with its departments and teams (first 200 organizations)." />
      {orgs.length === 0 ? <Panel><EmptyBlock icon="tree" title="No organizations yet" /></Panel> : (
        <div className="space-y-4">
          {orgs.map((o) => {
            const orgTeams = teams.filter((t) => t.organizationId === o.id);
            return (
              <Panel key={o.id}>
                <Link href={`/admin/organizations/${o.id}`} className="font-bold text-[15px] hover:underline">{o.name}</Link>
                <span className="ml-2 text-[12px]" style={{ color: "var(--text-muted)" }}>{o._count.users} users · {o.departments.length} departments · {orgTeams.length} teams</span>
                {o.departments.length === 0 && orgTeams.length === 0 ? <p className="text-[12.5px] mt-2" style={{ color: "var(--text-secondary)" }}>No departments or teams defined.</p> : (
                  <ul className="mt-3 ml-3 pl-4 space-y-2" style={{ borderLeft: "2px solid var(--border)" }}>
                    {o.departments.map((d) => (
                      <li key={d.id} className="text-[13px]"><b>{d.name}</b> <span style={{ color: "var(--text-muted)" }}>· {d._count.members} members</span>
                        <ul className="ml-4 mt-1 space-y-0.5">{orgTeams.filter((t) => t.departmentId === d.id).map((t) => <li key={t.id} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>↳ {t.name} ({t._count.members})</li>)}</ul></li>
                    ))}
                    {orgTeams.filter((t) => !t.departmentId).map((t) => <li key={t.id} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>Team: {t.name} ({t._count.members})</li>)}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
