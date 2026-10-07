import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { avgResolutionHours } from "@/lib/admin/reports";
import { resolveRange } from "@/lib/admin/range";
import { breachedWhere } from "@/lib/admin/sla";
import { DataTable, PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { formatStatus } from "@/lib/status-tone";

export const dynamic = "force-dynamic";

export default async function SupportAnalyticsPage() {
  await pageGuard();
  const range = resolveRange({ range: "30d" });
  const where = { createdAt: { gte: range.from, lt: range.to } };
  const [created, byPriority, byCategory, byStatus, res, breached, open] = await Promise.all([
    prisma.supportTicket.count({ where }), prisma.supportTicket.groupBy({ by: ["priority"], where, _count: true }), prisma.supportTicket.groupBy({ by: ["category"], where, _count: true, orderBy: { _count: { category: "desc" } } }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: true }), avgResolutionHours(range), prisma.supportTicket.count({ where: breachedWhere() }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
  ]);
  return (
    <>
      <PageHeader title="Support Analytics" description="Last 30 days." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatTile label="Tickets opened" value={created} /><StatTile label="Currently open" value={open} href="/admin/support" />
        <StatTile label="Avg time to resolve" value={res.avgHours === null ? "—" : `${res.avgHours}h`} hint={`${res.resolved} resolved in period`} /><StatTile label="SLA breached (open)" value={breached} href="/admin/support/sla" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {[["By priority", byPriority.map((x) => [x.priority, x._count] as const)], ["By category", byCategory.map((x) => [x.category, x._count] as const)], ["All tickets by status", byStatus.map((x) => [x.status, x._count] as const)]].map(([t, rows]) => (
          <Panel key={t as string} title={t as string} bodyClass="p-0 pb-2"><div className="pt-2"><DataTable rowKey={(r) => r[0]} rows={rows as (readonly [string, number])[]} columns={[{ key: "k", header: "", render: (r) => formatStatus(r[0]) }, { key: "v", header: "Tickets", render: (r) => <b>{r[1]}</b> }]} /></div></Panel>))}
      </div>
    </>
  );
}
