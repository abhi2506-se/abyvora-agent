import Link from "next/link";
import { listTickets, type TicketView } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, PriorityPill, StatusPill } from "@/components/admin/ui";
import { AssignTicketButton } from "@/components/admin/forms";
import { slaState } from "@/lib/admin/sla";
import { relativeTime } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
import type { SupportTicketStatus } from "@prisma/client";

const STATUSES: SupportTicketStatus[] = ["SUBMITTED","ADMIN_REVIEW","NEEDS_INFORMATION","ADMIN_ASSIGNED","ASSIGNED_TO_AGENT","AGENT_IN_PROGRESS","ESCALATED_TO_ADMIN","ESCALATION_REJECTED","FORWARDED_TO_IT","IT_ASSIGNED","IT_IN_PROGRESS","WAITING_FOR_USER","RESOLVED","CLOSED","REOPENED","CANCELLED"];

export async function TicketListPage({ view, title, description, base, sp, userId }: { view: TicketView; title: string; description: string; base: string; sp: SP; userId?: string }) {
  const page = parsePage(first(sp.page));
  const { total, rows } = await listTickets({ view, q: first(sp.q), status: oneOf(first(sp.status), STATUSES), priority: oneOf(first(sp.priority), ["LOW", "MEDIUM", "HIGH"] as const), page, userId });
  return (
    <>
      <PageHeader title={title} description={description} actions={<AssignTicketButton />} />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset={base} fields={[
          { name: "q", type: "search", placeholder: "Search ticket number or subject…" },
          ...(view === "all" ? [{ name: "status", type: "select" as const, label: "Any status", options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) }] : []),
          { name: "priority", type: "select", label: "Any priority", options: ["HIGH", "MEDIUM", "LOW"].map((p) => ({ value: p, label: p })) },
        ]} />
        <DataTable rowKey={(t) => t.id} rows={rows} empty={<EmptyBlock icon="ticket" title="No tickets in this view" hint="Nothing matches right now." />}
          columns={[
            { key: "n", header: "Ticket", render: (t) => <Link href={`/admin/support/${t.id}`} className="adm-link-text">{t.ticketNumber}</Link> },
            { key: "s", header: "Subject", render: (t) => <Link href={`/admin/support/${t.id}`} className="hover:underline block max-w-[260px] truncate">{t.title}</Link> },
            { key: "o", header: "Organization", render: (t) => t.organization ? <Link href={`/admin/organizations/${t.organization.id}`} className="hover:underline">{t.organization.name}</Link> : (t.client?.company ?? t.client?.name ?? "ABYVORA direct") },
            { key: "st", header: "Status", render: (t) => <StatusPill value={t.status} /> },
            { key: "p", header: "Priority", render: (t) => <PriorityPill value={t.priority} /> },
            { key: "sla", header: "SLA", render: (t) => { if (["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status)) return "—"; const s = slaState(t.createdAt, t.priority); return <Badge tone={s.state === "breached" ? "danger" : s.state === "at_risk" ? "warning" : "success"}>{s.state === "breached" ? `Breached ${Math.abs(Math.round(s.hoursLeft))}h` : `${Math.round(s.hoursLeft)}h left`}</Badge>; } },
            { key: "a", header: "Assigned", render: (t) => t.assignedAgent?.user?.name ?? t.assignedITSupport?.name ?? <span style={{ color: "var(--warning)" }}>Unassigned</span> },
            { key: "u", header: "Updated", render: (t) => relativeTime(t.updatedAt) },
          ]} />
        <Pagination base={base} sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
