import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { SLA_HOURS, slaDeadline, slaState } from "@/lib/admin/sla";
import { DataTable, EmptyBlock, PageHeader, Panel, PriorityPill, StatTile, StatusPill } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SlaMonitorPage() {
  await pageGuard();
  const open = await prisma.supportTicket.findMany({
    where: { status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } }, take: 500, orderBy: { createdAt: "asc" },
    select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true, organization: { select: { name: true } } },
  });
  const rows = open.map((t) => ({ ...t, sla: slaState(t.createdAt, t.priority), due: slaDeadline(t.createdAt, t.priority) })).sort((a, b) => a.sla.hoursLeft - b.sla.hoursLeft);
  const breached = rows.filter((r) => r.sla.state === "breached").length, risk = rows.filter((r) => r.sla.state === "at_risk").length;
  return (
    <>
      <PageHeader title="SLA Monitor" description={`Resolution targets by priority: High ${SLA_HOURS.HIGH}h · Medium ${SLA_HOURS.MEDIUM}h · Low ${SLA_HOURS.LOW}h from ticket creation.`} />
      <div className="grid grid-cols-3 gap-4 mb-5"><StatTile label="Open tickets" value={rows.length} /><StatTile label="At risk (<25% time left)" value={risk} /><StatTile label="Breached" value={breached} /></div>
      <Panel bodyClass="p-0 pb-2"><div className="pt-3">
        <DataTable rowKey={(t) => t.id} rows={rows} empty={<EmptyBlock icon="clock" title="No open tickets" hint="Every ticket is resolved — nothing to track." />}
          columns={[
            { key: "n", header: "Ticket", render: (t) => <Link href={`/admin/support/${t.id}`} className="adm-link-text">{t.ticketNumber}</Link> }, { key: "s", header: "Subject", render: (t) => <span className="block max-w-[260px] truncate">{t.title}</span> },
            { key: "o", header: "Organization", render: (t) => t.organization?.name ?? "ABYVORA direct" }, { key: "p", header: "Priority", render: (t) => <PriorityPill value={t.priority} /> },
            { key: "st", header: "Status", render: (t) => <StatusPill value={t.status} /> }, { key: "d", header: "Due", render: (t) => t.due.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) },
            { key: "sla", header: "SLA", render: (t) => <Badge tone={t.sla.state === "breached" ? "danger" : t.sla.state === "at_risk" ? "warning" : "success"}>{t.sla.state === "breached" ? `Breached by ${Math.abs(Math.round(t.sla.hoursLeft))}h` : `${Math.round(t.sla.hoursLeft)}h left`}</Badge> },
          ]} /></div></Panel>
    </>
  );
}
