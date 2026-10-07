import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { first, type SP } from "@/lib/admin/paging";
import { buildTree, countNodes, type TreeNode } from "@/lib/admin/tree";
import { EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Node({ n }: { n: TreeNode }) {
  return (
    <li>
      <Link href={`/admin/users/${n.id}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 my-1 text-[13px] hover:opacity-80" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <b>{n.name}</b><span style={{ color: "var(--text-muted)" }}>{n.role.replace(/_/g, " ")}{n.department ? ` · ${n.department}` : ""}</span>
      </Link>
      {n.reports.length > 0 && <ul className="ml-5 pl-4" style={{ borderLeft: "2px solid var(--border)" }}>{n.reports.map((r) => <Node key={r.id} n={r} />)}</ul>}
    </li>
  );
}

export default async function OrgChartPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const orgId = first(sp.org) || null;
  const [orgs, people] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: "asc" }, take: 300, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { organizationId: orgId, role: { notIn: ["PLATFORM_OWNER", "CLIENT"] }, status: { not: "DISABLED" } }, take: 1000, select: { id: true, name: true, role: true, managerId: true, department: { select: { name: true } } } }),
  ]);
  const roots = buildTree(people.map((p) => ({ id: p.id, name: p.name, role: p.role, managerId: p.managerId, department: p.department?.name })));
  return (
    <>
      <PageHeader title="Organization Chart" description="Reporting lines by manager. Pick an organization, or view ABYVORA's internal chart." />
      <form method="get" className="mb-4 flex gap-2 items-center">
        <select name="org" defaultValue={orgId ?? ""} className="field-input" style={{ width: "auto" }} aria-label="Organization"><option value="">ABYVORA (internal)</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <button className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>Show</button>
      </form>
      <Panel>{roots.length === 0 ? <EmptyBlock icon="tree" title="No people to chart" hint="Set a manager on users to build reporting lines." /> : (<><p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>{countNodes(roots)} people</p><ul>{roots.map((r) => <Node key={r.id} n={r} />)}</ul></>)}</Panel>
    </>
  );
}
