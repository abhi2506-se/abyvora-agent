import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listInvoices, listPayments, listTickets, listUsers } from "@/lib/admin/lists";
import { DataTable, EmptyBlock, Panel, PriorityPill, StatTile, StatusPill } from "@/components/admin/ui";
import { AuditTable } from "@/components/admin/audit-table";
import { NewUserButton } from "@/components/admin/forms";
import { OrgDecisionButtons, OrgLifecycleButtons, SubscriptionControls } from "@/components/admin/org-controls";
import { formatINR, formatNumber, relativeTime } from "@/lib/admin/format";
import { msAgo } from "@/lib/admin/range";
import { REVENUE_PAYMENT_STATUSES } from "@/lib/admin/revenue";
import type { Role } from "@prisma/client";
import type { SP } from "@/lib/admin/paging";

export const ORG_TABS = [
  ["overview", "Overview"], ["users", "Users"], ["managers", "Managers"], ["agents", "Agents"], ["employees", "Employees"], ["clients", "Clients"],
  ["projects", "Projects"], ["services", "Services"], ["support", "Support"], ["payments", "Payments"], ["invoices", "Invoices"], ["subscription", "Subscription"],
  ["usage", "Usage"], ["analytics", "Analytics"], ["activity", "Activity"], ["security", "Security"], ["audit", "Audit Logs"], ["integrations", "Integrations"],
] as const;
export type OrgTab = (typeof ORG_TABS)[number][0];

type OrgCtx = { id: string; name: string; status: string; ownerId: string | null; planName: string | null; maxUsers: number | null };

const MANAGER_ROLES: Role[] = ["HIGHER_MANAGER", "MID_MANAGER", "LOWER_MANAGER"];

async function UsersByRoles({ org, roles, title }: { org: OrgCtx; roles?: Role[]; title: string }) {
  const where = { organizationId: org.id, ...(roles ? { role: { in: roles } } : {}) };
  const rows = await prisma.user.findMany({ where, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, status: true, mfaEnabled: true, lastLoginAt: true, department: { select: { name: true } }, manager: { select: { name: true } } } });
  return (
    <Panel title={title} bodyClass="p-0 pb-2" action={<NewUserButton organizationId={org.id} />}><div className="pt-3">
      <DataTable rowKey={(u) => u.id} rows={rows} empty={<EmptyBlock icon="users" title={`No ${title.toLowerCase()} yet`} />}
        columns={[
          { key: "n", header: "Name", render: (u) => <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{u.email}</span></Link> },
          { key: "r", header: "Role", render: (u) => u.role.replace(/_/g, " ") },
          { key: "d", header: "Department", render: (u) => u.department?.name ?? "—" },
          { key: "m", header: "Manager", render: (u) => u.manager?.name ?? "—" },
          { key: "s", header: "Status", render: (u) => <StatusPill value={u.status} /> },
          { key: "mfa", header: "MFA", render: (u) => (u.mfaEnabled ? "On" : "Off") },
          { key: "l", header: "Last login", render: (u) => (u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never") },
        ]} /></div>
    </Panel>
  );
}

export async function OrgTabContent({ tab, org, sp }: { tab: OrgTab; org: OrgCtx; sp: SP }) {
  const id = org.id;
  switch (tab) {
    case "overview": {
      const [org360, counts, rev] = await Promise.all([
        prisma.organization.findUnique({ where: { id }, select: { legalName: true, industry: true, website: true, contactEmail: true, contactPhone: true, createdAt: true, approvedAt: true, rejectedReason: true, approvedBy: { select: { name: true } } } }),
        Promise.all([prisma.user.count({ where: { organizationId: id } }), prisma.client.count({ where: { organizationId: id } }), prisma.project.count({ where: { organizationId: id } }),
          prisma.supportTicket.count({ where: { organizationId: id, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } })]),
        prisma.payment.aggregate({ where: { organizationId: id, status: { in: [...REVENUE_PAYMENT_STATUSES] } }, _sum: { amount: true } }),
      ]);
      const owner = org.ownerId ? await prisma.user.findUnique({ where: { id: org.ownerId }, select: { id: true, name: true, email: true } }) : null;
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <StatTile label="Users" value={formatNumber(counts[0])} /><StatTile label="Clients" value={formatNumber(counts[1])} />
            <StatTile label="Projects" value={formatNumber(counts[2])} /><StatTile label="Open tickets" value={formatNumber(counts[3])} />
            <StatTile label="Lifetime revenue" value={formatINR(Number(rev._sum.amount ?? 0))} hint="Settled payments, before refunds" />
          </div>
          <Panel title="Details">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
              {([["Legal name", org360?.legalName], ["Industry", org360?.industry], ["Website", org360?.website], ["Contact email", org360?.contactEmail], ["Contact phone", org360?.contactPhone],
                ["Plan", org.planName], ["Created", org360?.createdAt.toLocaleDateString("en-IN")], ["Approved", org360?.approvedAt ? `${org360.approvedAt.toLocaleDateString("en-IN")}${org360.approvedBy ? ` by ${org360.approvedBy.name}` : ""}` : null],
                ["Owner", owner ? `${owner.name} (${owner.email})` : null]] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k}><dt className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</dt><dd>{v || "—"}</dd></div>))}
            </dl>
            {org360?.rejectedReason && <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>Rejection reason: {org360.rejectedReason}</p>}
          </Panel>
          <Panel title="Lifecycle">
            {org.status === "PENDING_REVIEW" || org.status === "CHANGES_REQUESTED" ? <OrgDecisionButtons orgId={id} orgName={org.name} /> : null}
            <OrgLifecycleButtons orgId={id} status={org.status} />
            {["REJECTED", "TERMINATED"].includes(org.status) && <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>This organization is {org.status.toLowerCase()}; no further lifecycle actions are available.</p>}
          </Panel>
        </div>
      );
    }
    case "users": {
      const { rows, total } = await listUsers({ organizationId: id, page: 1 });
      return (
        <Panel title={`Users (${total})`} bodyClass="p-0 pb-2" action={<NewUserButton organizationId={id} />}><div className="pt-3">
          <DataTable rowKey={(u) => u.id} rows={rows} empty={<EmptyBlock icon="users" title="No users yet" />}
            columns={[
              { key: "n", header: "Name", render: (u) => <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{u.email}</span></Link> },
              { key: "r", header: "Role", render: (u) => u.role.replace(/_/g, " ") }, { key: "s", header: "Status", render: (u) => <StatusPill value={u.status} /> },
              { key: "l", header: "Last login", render: (u) => (u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never") }]} /></div>
          {total > rows.length && <p className="px-5 pb-3 text-[12.5px]"><Link className="adm-link-text" href={`/admin/users?org=${id}`}>View all {total} users →</Link></p>}
        </Panel>
      );
    }
    case "managers": return <UsersByRoles org={org} roles={MANAGER_ROLES} title="Managers" />;
    case "agents": return <UsersByRoles org={org} roles={["AGENT"]} title="Agents" />;
    case "employees": return <UsersByRoles org={org} roles={["EMPLOYEE", "HR"]} title="Employees" />;
    case "clients": {
      const rows = await prisma.client.findMany({ where: { organizationId: id }, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, company: true, createdAt: true, _count: { select: { projects: true } } } });
      return (<Panel title="Clients" bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(c) => c.id} rows={rows} empty={<EmptyBlock icon="users" title="No clients yet" />}
        columns={[{ key: "n", header: "Client", render: (c) => <>{c.name}<span className="block text-[11.5px]" style={{ color: "var(--text-muted)" }}>{c.email}</span></> }, { key: "c", header: "Company", render: (c) => c.company ?? "—" }, { key: "p", header: "Projects", render: (c) => c._count.projects }, { key: "d", header: "Added", render: (c) => c.createdAt.toLocaleDateString("en-IN") }]} /></div></Panel>);
    }
    case "projects": {
      const rows = await prisma.project.findMany({ where: { organizationId: id }, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, name: true, projectType: true, status: true, totalValue: true, createdAt: true, client: { select: { name: true } } } });
      return (<Panel title="Projects" bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(p) => p.id} rows={rows} empty={<EmptyBlock icon="box" title="No projects yet" />}
        columns={[{ key: "n", header: "Project", render: (p) => <span className="font-semibold">{p.name}</span> }, { key: "c", header: "Client", render: (p) => p.client.name }, { key: "t", header: "Type", render: (p) => p.projectType }, { key: "s", header: "Status", render: (p) => <StatusPill value={p.status} /> }, { key: "v", header: "Value", render: (p) => (p.totalValue ? formatINR(Number(p.totalValue)) : "—") }]} /></div></Panel>);
    }
    case "services": {
      const rows = await prisma.$queryRaw<{ service: string; projects: bigint; revenue: unknown }[]>`
        SELECT pr."projectType" AS service, COUNT(DISTINCT pr.id) AS projects, COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','REFUND_PENDING')),0) AS revenue
        FROM "Project" pr LEFT JOIN "Payment" p ON p."projectId" = pr.id WHERE pr."organizationId" = ${id} GROUP BY 1 ORDER BY 3 DESC`;
      return (<Panel title="Services (by project type)" bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(r) => r.service} rows={rows} empty={<EmptyBlock icon="box" title="No services delivered yet" />}
        columns={[{ key: "s", header: "Service", render: (r) => <span className="font-semibold">{r.service}</span> }, { key: "p", header: "Projects", render: (r) => Number(r.projects) }, { key: "r", header: "Settled revenue", render: (r) => formatINR(Number(r.revenue)) }]} /></div></Panel>);
    }
    case "support": {
      const { rows, total } = await listTickets({ view: "all", organizationId: id, page: 1, take: 50 });
      return (<Panel title={`Support tickets (${total})`} bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(t) => t.id} rows={rows} empty={<EmptyBlock icon="ticket" title="No tickets" />}
        columns={[{ key: "n", header: "Ticket", render: (t) => <Link href={`/admin/support/${t.id}`} className="adm-link-text">{t.ticketNumber}</Link> }, { key: "t", header: "Subject", render: (t) => t.title }, { key: "s", header: "Status", render: (t) => <StatusPill value={t.status} /> }, { key: "p", header: "Priority", render: (t) => <PriorityPill value={t.priority} /> }, { key: "u", header: "Updated", render: (t) => relativeTime(t.updatedAt) }]} /></div></Panel>);
    }
    case "payments": {
      const { rows, total } = await listPayments({ organizationId: id, page: 1 });
      return (<Panel title={`Payments (${total})`} bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(p) => p.id} rows={rows} empty={<EmptyBlock icon="card" title="No payments" />}
        columns={[{ key: "a", header: "Amount", render: (p) => formatINR(Number(p.amount)) }, { key: "s", header: "Status", render: (p) => <StatusPill value={p.status} /> }, { key: "m", header: "Method", render: (p) => p.paymentMethod ?? "—" }, { key: "pr", header: "Project", render: (p) => p.project.name }, { key: "d", header: "Date", render: (p) => (p.paidAt ?? p.createdAt).toLocaleDateString("en-IN") }]} /></div></Panel>);
    }
    case "invoices": {
      const { rows, total } = await listInvoices({ organizationId: id, page: 1 });
      return (<Panel title={`Invoices (${total})`} bodyClass="p-0 pb-2"><div className="pt-3"><DataTable rowKey={(i) => i.id} rows={rows} empty={<EmptyBlock icon="file" title="No invoices" />}
        columns={[{ key: "n", header: "Invoice", render: (i) => <Link href={`/invoice/${i.id}`} className="adm-link-text">{i.invoiceNumber}</Link> }, { key: "b", header: "Billed to", render: (i) => i.billingName }, { key: "t", header: "Total", render: (i) => formatINR(Number(i.total)) }, { key: "s", header: "Status", render: (i) => <StatusPill value={i.paymentStatus} /> }, { key: "d", header: "Issued", render: (i) => i.issuedAt.toLocaleDateString("en-IN") }]} /></div></Panel>);
    }
    case "subscription": {
      const sub = await prisma.organizationSubscription.findUnique({ where: { organizationId: id }, include: { plan: true } });
      return (
        <div className="space-y-5">
          <Panel title="Current subscription">
            {sub ? (
              <dl className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-[13px] mb-4">
                <div><dt className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Plan</dt><dd className="font-semibold">{sub.plan.name} · {formatINR(Number(sub.plan.priceMonthly))}/mo</dd></div>
                <div><dt className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Status</dt><dd><StatusPill value={sub.status} /></dd></div>
                <div><dt className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Current period</dt><dd>{sub.currentPeriodStart.toLocaleDateString("en-IN")} → {sub.currentPeriodEnd.toLocaleDateString("en-IN")}</dd></div>
                <div><dt className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Grace ends</dt><dd>{sub.gracePeriodEndsAt ? sub.gracePeriodEndsAt.toLocaleDateString("en-IN") : "—"}</dd></div>
              </dl>
            ) : <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>No subscription yet. Start one by choosing a plan.</p>}
            <SubscriptionControls orgId={id} hasSubscription={!!sub} />
          </Panel>
        </div>
      );
    }
    case "usage": {
      const [users, projects, tickets, docs, threads] = await Promise.all([prisma.user.count({ where: { organizationId: id } }), prisma.project.count({ where: { organizationId: id } }), prisma.supportTicket.count({ where: { organizationId: id } }), prisma.document.count({ where: { organizationId: id } }), prisma.emailThread.count({ where: { organizationId: id } })]);
      const pct = org.maxUsers ? Math.min(100, Math.round((users / org.maxUsers) * 100)) : null;
      return (
        <div className="space-y-5">
          <Panel title="Seat usage">
            <p className="text-[13px] mb-2">{users} user{users === 1 ? "" : "s"}{org.maxUsers ? ` of ${org.maxUsers} allowed on ${org.planName}` : org.planName ? ` · ${org.planName} has no user cap` : " · no plan assigned"}</p>
            {pct !== null && <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "var(--danger)" : "var(--brand)" }} /></div>}
          </Panel>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4"><StatTile label="Projects" value={projects} /><StatTile label="Tickets" value={tickets} /><StatTile label="Documents" value={docs} /><StatTile label="Email threads" value={threads} /></div>
        </div>
      );
    }
    case "analytics": {
      const rows = await prisma.$queryRaw<{ m: Date; revenue: unknown }[]>`
        SELECT date_trunc('month', "paidAt") AS m, SUM(amount) AS revenue FROM "Payment"
        WHERE "organizationId" = ${id} AND status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','REFUND_PENDING') AND "paidAt" >= now() - interval '6 months' GROUP BY 1 ORDER BY 1`;
      const max = Math.max(1, ...rows.map((r) => Number(r.revenue)));
      return (<Panel title="Revenue — last 6 months">{rows.length === 0 ? <EmptyBlock icon="chart" title="No settled payments in the last 6 months" /> : (
        <ul className="space-y-2.5">{rows.map((r) => (<li key={String(r.m)} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-[12.5px]"><span>{new Date(r.m).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })}</span><span className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}><span className="block h-full rounded-full" style={{ width: `${(Number(r.revenue) / max) * 100}%`, background: "var(--brand)" }} /></span><b>{formatINR(Number(r.revenue))}</b></li>))}</ul>)}</Panel>);
    }
    case "activity": return <AuditTable base={`/admin/organizations/${id}`} sp={{ ...sp, tab: "activity" }} page={1} filters={{ organizationId: id }} />;
    case "audit": return <AuditTable base={`/admin/organizations/${id}`} sp={{ ...sp, tab: "audit" }} page={Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1)} filters={{ organizationId: id }} />;
    case "security": {
      const day = msAgo(30 * 86400000);
      const [total, mfa, disabled, failed, stale] = await Promise.all([
        prisma.user.count({ where: { organizationId: id } }), prisma.user.count({ where: { organizationId: id, mfaEnabled: true } }),
        prisma.user.count({ where: { organizationId: id, status: "DISABLED" } }), prisma.auditLog.count({ where: { organizationId: id, status: "FAILED", createdAt: { gte: day } } }),
        prisma.user.count({ where: { organizationId: id, status: "ACTIVE", OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: day } }] } }),
      ]);
      return (<div className="grid grid-cols-2 xl:grid-cols-4 gap-4"><StatTile label="MFA coverage" value={total ? `${Math.round((mfa / total) * 100)}%` : "—"} hint={`${mfa} of ${total} users`} /><StatTile label="Disabled accounts" value={disabled} /><StatTile label="Inactive 30d+" value={stale} hint="Active accounts with no recent sign-in" /><StatTile label="Failed/blocked actions (30d)" value={failed} href={`/admin/organizations/${id}?tab=audit&status=FAILED`} /></div>);
    }
    case "integrations": {
      const [payments, threads] = await Promise.all([prisma.payment.count({ where: { organizationId: id, provider: "razorpay" } }), prisma.emailThread.count({ where: { organizationId: id } })]);
      return (<Panel title="Integrations"><ul className="text-[13px] space-y-2.5">
        <li className="flex justify-between"><span>Razorpay payments</span><b>{payments > 0 ? `${payments} transactions` : "No transactions"}</b></li>
        <li className="flex justify-between"><span>Email (Resend)</span><b>{threads > 0 ? `${threads} threads` : "No email activity"}</b></li>
        <li className="pt-2" style={{ color: "var(--text-secondary)" }}>Per-organization custom integrations (webhooks, API keys) are not yet supported by the platform, so none can be shown here.</li></ul></Panel>);
    }
  }
}
