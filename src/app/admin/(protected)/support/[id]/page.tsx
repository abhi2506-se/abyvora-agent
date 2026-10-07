import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel, PriorityPill, StatusPill } from "@/components/admin/ui";
import { ReplyBox, TicketControls } from "@/components/admin/ticket-workspace";
import { slaState } from "@/lib/admin/sla";
import { TICKET_TRANSITIONS } from "@/lib/support-lifecycle";
import { relativeTime } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/** Platform Owner ticket workspace. Reads directly (post-guard) and acts through the EXISTING /api/support/tickets/* endpoints. */
export default async function TicketWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard();
  const { id } = await params;
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } }, raisedBy: { select: { name: true, email: true } }, client: { select: { name: true, company: true } },
      assignedAgent: { select: { user: { select: { name: true } } } }, assignedITSupport: { select: { name: true } }, relatedProject: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 }, activities: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!t) notFound();
  const senders = await prisma.user.findMany({ where: { id: { in: [...new Set(t.messages.map((m) => m.senderId))] } }, select: { id: true, name: true } });
  const name = new Map(senders.map((s) => [s.id, s.name]));
  const closed = ["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status);
  const sla = closed ? null : slaState(t.createdAt, t.priority);
  return (
    <>
      <PageHeader title={`${t.ticketNumber} — ${t.title}`} description={`Raised ${relativeTime(t.createdAt)} by ${t.raisedBy.name} (${t.raisedByRole.replace(/_/g, " ")})`}
        actions={<><StatusPill value={t.status} /><PriorityPill value={t.priority} />{sla && <Badge tone={sla.state === "breached" ? "danger" : sla.state === "at_risk" ? "warning" : "success"}>{sla.state === "breached" ? "SLA breached" : `${Math.round(sla.hoursLeft)}h to SLA`}</Badge>}</>} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <Panel title="Description"><p className="text-[13.5px] whitespace-pre-wrap">{t.description}</p>
            {t.resolutionSummary && <p className="mt-3 text-[13px] rounded-lg p-3" style={{ background: "var(--success-soft)" }}><b>Resolution:</b> {t.resolutionSummary}</p>}
            {t.escalationReason && <p className="mt-3 text-[13px] rounded-lg p-3" style={{ background: "var(--warning-soft)" }}><b>Escalation reason:</b> {t.escalationReason}</p>}</Panel>
          <Panel title="Conversation">
            {t.messages.length === 0 ? <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>No messages yet.</p> : (
              <ul className="space-y-3">{t.messages.map((m) => (
                <li key={m.id} className="rounded-xl p-3 text-[13px]" style={{ background: m.isInternal ? "var(--warning-soft)" : "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="flex justify-between text-[11.5px] mb-1" style={{ color: "var(--text-muted)" }}><span><b style={{ color: "var(--text-primary)" }}>{name.get(m.senderId) ?? "Unknown"}</b> · {m.senderRole.replace(/_/g, " ")}{m.isInternal && " · INTERNAL NOTE"}</span><span>{relativeTime(m.createdAt)}</span></div>
                  <p className="whitespace-pre-wrap">{m.message}</p></li>))}</ul>)}
            {!closed && <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}><ReplyBox ticketId={t.id} /></div>}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Actions"><TicketControls ticketId={t.id} status={t.status} priority={t.priority}
            // Derived server-side from the same transition table the API enforces: a ticket must be in review before it can be assigned.
            canReview={TICKET_TRANSITIONS[t.status].includes("ADMIN_REVIEW")} canAssign={t.status === "ADMIN_REVIEW" || TICKET_TRANSITIONS[t.status].includes("ASSIGNED_TO_AGENT")} /></Panel>
          <Panel title="Details">
            <dl className="text-[13px] space-y-2.5">
              {([["Organization", t.organization ? <Link key="o" className="adm-link-text" href={`/admin/organizations/${t.organization.id}`}>{t.organization.name}</Link> : (t.client?.company ?? t.client?.name ?? "ABYVORA direct")],
                ["Category", t.category.replace(/_/g, " ")], ["Assigned agent", t.assignedAgent?.user?.name ?? "—"], ["Assigned IT", t.assignedITSupport?.name ?? "—"], ["Project", t.relatedProject?.name ?? "—"], ["Raised by", `${t.raisedBy.name} · ${t.raisedBy.email}`]] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</dt><dd>{v}</dd></div>))}
            </dl></Panel>
          <Panel title="Activity">
            <ul className="space-y-2 text-[12.5px]">{t.activities.map((a) => (<li key={a.id}><b>{a.action.replace(/[._]/g, " ")}</b>{a.newStatus && <> → {a.newStatus.replace(/_/g, " ")}</>}{a.note && <span style={{ color: "var(--text-secondary)" }}> — {a.note}</span>}<span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{relativeTime(a.createdAt)}</span></li>))}</ul></Panel>
        </div>
      </div>
    </>
  );
}
