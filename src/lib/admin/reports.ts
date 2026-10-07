import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { densify, type DateRange, type Grouping } from "@/lib/admin/range";
import { getRevenueByService, getRevenueOverview, getTopOrganizations } from "@/lib/admin/dashboard";
import type { Cell } from "@/lib/admin/csv";

export const REPORT_TYPES = ["business", "user-activity", "financial", "organization", "revenue", "support", "custom"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { title: string; description: string }> = {
  business: { title: "Business Report", description: "Growth of organizations, users, revenue and support load per period." },
  "user-activity": { title: "User Activity Report", description: "Accounts by role: totals, new in period, active in period (by last sign-in), MFA coverage." },
  financial: { title: "Financial Report", description: "Gross, refunds and net revenue per period. Failed/cancelled payments are excluded from revenue." },
  organization: { title: "Organization Report", description: "Every organization with plan, status, user count and subscription state." },
  revenue: { title: "Revenue Report", description: "Net revenue by service and by organization for the period." },
  support: { title: "Support Report", description: "Ticket volume, status/priority mix and average time-to-resolve." },
  custom: { title: "Custom Report", description: "Choose a dataset and period, then export." },
};

export const CUSTOM_DATASETS = ["organizations", "users", "tickets", "payments", "audit"] as const;
export type CustomDataset = (typeof CUSTOM_DATASETS)[number];

export type ReportData = { title: string; description: string; columns: string[]; rows: Cell[][]; note?: string };

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const u = (g: Grouping) => Prisma.raw(`'${g}'`);

async function countsByBucket(table: "Organization" | "User" | "SupportTicket", range: DateRange, g: Grouping) {
  const extra = table === "User" ? Prisma.raw(`AND role <> 'PLATFORM_OWNER'`) : Prisma.empty;
  const rows = await prisma.$queryRaw<{ bucket: Date; total: bigint }[]>`
    SELECT date_trunc(${u(g)}, "createdAt") AS bucket, COUNT(*) AS total
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to} ${extra}
    GROUP BY 1 ORDER BY 1`;
  return densify(range, g, rows.map((r) => ({ bucket: r.bucket, value: n(r.total) })));
}

export async function avgResolutionHours(range: DateRange) {
  const r = await prisma.$queryRaw<{ hrs: number | null; resolved: bigint }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (a."createdAt" - t."createdAt")) / 3600.0) AS hrs, COUNT(DISTINCT t.id) AS resolved
    FROM "SupportTicketActivity" a JOIN "SupportTicket" t ON t.id = a."ticketId"
    WHERE a."newStatus" = 'RESOLVED' AND a."createdAt" >= ${range.from} AND a."createdAt" < ${range.to}`;
  return { avgHours: r[0]?.hrs == null ? null : Math.round(Number(r[0].hrs) * 10) / 10, resolved: n(r[0]?.resolved) };
}

export async function buildReport(type: ReportType, range: DateRange, g: Grouping, opts: { dataset?: CustomDataset } = {}): Promise<ReportData> {
  const meta = REPORT_META[type];
  switch (type) {
    case "business": {
      const [orgs, users, tickets, rev] = await Promise.all([
        countsByBucket("Organization", range, g), countsByBucket("User", range, g), countsByBucket("SupportTicket", range, g), getRevenueOverview(range, g),
      ]);
      return { ...meta, columns: ["Period starting", "New organizations", "New users", "Tickets opened", "Net revenue (INR)"],
        rows: orgs.map((o, i) => [o.bucket, o.value, users[i].value, tickets[i].value, rev.series[i].net]) };
    }
    case "financial":
    case "revenue": {
      if (type === "financial") {
        const rev = await getRevenueOverview(range, g);
        return { ...meta, columns: ["Period starting", "Gross (INR)", "Refunds (INR)", "Net (INR)"], rows: rev.series.map((s) => [s.bucket, s.gross, s.refunds, s.net]),
          note: `Failed/cancelled in period: ${rev.current.failedCount} payments (₹${rev.current.failedAmount}) — excluded from revenue.` };
      }
      const [svc, orgs] = await Promise.all([getRevenueByService(range, 50), getTopOrganizations(range, "revenue", undefined, 50)]);
      return { ...meta, columns: ["Type", "Name", "Revenue (INR)", "Detail"],
        rows: [...svc.rows.map((s): Cell[] => ["Service", s.service, s.revenue, `${s.payments} payments · ${s.pct}%`]),
               ...orgs.map((o): Cell[] => ["Organization", o.name, o.revenue, `${o.plan ?? "No plan"} · ${o.users} users`])] };
    }
    case "user-activity": {
      const [totals, fresh, active, mfa] = await Promise.all([
        prisma.user.groupBy({ by: ["role"], _count: true }),
        prisma.user.groupBy({ by: ["role"], where: { createdAt: { gte: range.from, lt: range.to } }, _count: true }),
        prisma.user.groupBy({ by: ["role"], where: { lastLoginAt: { gte: range.from, lt: range.to } }, _count: true }),
        prisma.user.groupBy({ by: ["role"], where: { mfaEnabled: true }, _count: true }),
      ]);
      const m = (a: { role: string; _count: number }[]) => new Map(a.map((x) => [x.role, x._count]));
      const [f, a, k] = [m(fresh), m(active), m(mfa)];
      return { ...meta, columns: ["Role", "Total", "New in period", "Active in period", "MFA enabled"],
        rows: totals.sort((x, y) => y._count - x._count).map((t) => [t.role, t._count, f.get(t.role) ?? 0, a.get(t.role) ?? 0, k.get(t.role) ?? 0]),
        note: "“Active” counts users whose most recent sign-in falls in the period (only the latest sign-in is stored)." };
    }
    case "organization": {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: "desc" }, take: 5000,
        select: { name: true, status: true, industry: true, createdAt: true, plan: { select: { name: true } }, subscription: { select: { status: true, currentPeriodEnd: true } }, _count: { select: { users: true, projects: true } } },
      });
      return { ...meta, columns: ["Organization", "Status", "Plan", "Subscription", "Renews/ends", "Users", "Projects", "Industry", "Created"],
        rows: orgs.map((o) => [o.name, o.status, o.plan?.name ?? "—", o.subscription?.status ?? "—", o.subscription?.currentPeriodEnd ?? null, o._count.users, o._count.projects, o.industry ?? "", o.createdAt]) };
    }
    case "support": {
      const where = { createdAt: { gte: range.from, lt: range.to } };
      const [byStatus, byPriority, byCategory, res] = await Promise.all([
        prisma.supportTicket.groupBy({ by: ["status"], where, _count: true }),
        prisma.supportTicket.groupBy({ by: ["priority"], where, _count: true }),
        prisma.supportTicket.groupBy({ by: ["category"], where, _count: true }),
        avgResolutionHours(range),
      ]);
      return { ...meta, columns: ["Dimension", "Value", "Tickets"],
        rows: [
          ...byStatus.map((x): Cell[] => ["Status", x.status, x._count]),
          ...byPriority.map((x): Cell[] => ["Priority", x.priority, x._count]),
          ...byCategory.map((x): Cell[] => ["Category", x.category, x._count]),
          ["Resolution", "Avg hours to resolve", res.avgHours],
          ["Resolution", "Tickets resolved in period", res.resolved],
        ] };
    }
    case "custom": {
      const ds = opts.dataset ?? "organizations";
      const w = { createdAt: { gte: range.from, lt: range.to } };
      if (ds === "users") {
        const r = await prisma.user.findMany({ where: { ...w, role: { not: "PLATFORM_OWNER" } }, take: 5000, orderBy: { createdAt: "desc" }, select: { name: true, email: true, role: true, status: true, mfaEnabled: true, lastLoginAt: true, createdAt: true, organization: { select: { name: true } } } });
        return { ...meta, columns: ["Name", "Email", "Role", "Status", "MFA", "Last login", "Created", "Organization"], rows: r.map((x) => [x.name, x.email, x.role, x.status, x.mfaEnabled, x.lastLoginAt, x.createdAt, x.organization?.name ?? "ABYVORA"]) };
      }
      if (ds === "tickets") {
        const r = await prisma.supportTicket.findMany({ where: w, take: 5000, orderBy: { createdAt: "desc" }, select: { ticketNumber: true, title: true, status: true, priority: true, category: true, createdAt: true, organization: { select: { name: true } } } });
        return { ...meta, columns: ["Ticket", "Subject", "Status", "Priority", "Category", "Created", "Organization"], rows: r.map((x) => [x.ticketNumber, x.title, x.status, x.priority, x.category, x.createdAt, x.organization?.name ?? "ABYVORA direct"]) };
      }
      if (ds === "payments") {
        const r = await prisma.payment.findMany({ where: w, take: 5000, orderBy: { createdAt: "desc" }, select: { providerPaymentId: true, amount: true, currency: true, status: true, paymentMethod: true, paidAt: true, createdAt: true, organization: { select: { name: true } } } });
        return { ...meta, columns: ["Payment ID", "Amount", "Currency", "Status", "Method", "Paid at", "Created", "Organization"], rows: r.map((x) => [x.providerPaymentId ?? "", Number(x.amount), x.currency, x.status, x.paymentMethod ?? "", x.paidAt, x.createdAt, x.organization?.name ?? "ABYVORA direct"]) };
      }
      if (ds === "audit") {
        const r = await prisma.auditLog.findMany({ where: w, take: 5000, orderBy: { createdAt: "desc" }, select: { createdAt: true, action: true, entityType: true, entityId: true, actorName: true, actorRole: true, status: true, description: true } });
        return { ...meta, columns: ["Time", "Action", "Entity", "Entity ID", "Actor", "Role", "Status", "Description"], rows: r.map((x) => [x.createdAt, x.action, x.entityType, x.entityId ?? "", x.actorName ?? "", x.actorRole, x.status, x.description ?? ""]) };
      }
      const r = await prisma.organization.findMany({ where: w, take: 5000, orderBy: { createdAt: "desc" }, select: { name: true, status: true, industry: true, contactEmail: true, createdAt: true, plan: { select: { name: true } } } });
      return { ...meta, columns: ["Organization", "Status", "Industry", "Contact", "Plan", "Created"], rows: r.map((x) => [x.name, x.status, x.industry ?? "", x.contactEmail ?? "", x.plan?.name ?? "—", x.createdAt]) };
    }
  }
}
