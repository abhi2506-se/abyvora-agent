import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeDelta,
  densify,
  previousRange,
  type DateRange,
  type Delta,
  type Grouping,
} from "@/lib/admin/range";
import {
  FAILED_PAYMENT_STATUSES,
  REVENUE_PAYMENT_STATUSES,
  REVENUE_STATUS_SQL,
  netRevenue,
} from "@/lib/admin/revenue";
import { describeAction, type ActivityTone } from "@/lib/admin/activity-labels";

/**
 * Platform Owner dashboard aggregation.
 *
 * Every function here is PLATFORM-WIDE by design and must only ever be called
 * after `requirePlatformOwner()` (the page / API route does that). None of
 * them accept an organizationId from the caller — the only inputs are a date
 * range and whitelisted enums.
 */

export const OPEN_TICKET_EXCLUDED = ["RESOLVED", "CLOSED", "CANCELLED"] as const;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const unitSql = (g: Grouping) => Prisma.raw(`'${g}'`);

// ─────────────────────────────────────────────────────────────────────────
// Revenue primitives (shared by KPI, chart, reports)
// ─────────────────────────────────────────────────────────────────────────
export async function revenueTotals(range: DateRange) {
  const [gross, refunds, failed] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: [...REVENUE_PAYMENT_STATUSES] }, paidAt: { gte: range.from, lt: range.to } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.refund.aggregate({
      where: { status: "PROCESSED", processedAt: { gte: range.from, lt: range.to } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: { in: [...FAILED_PAYMENT_STATUSES] }, createdAt: { gte: range.from, lt: range.to } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const g = num(gross._sum.amount);
  const r = num(refunds._sum.amount);
  return {
    gross: g,
    refunds: r,
    net: netRevenue(g, r),
    paymentCount: gross._count,
    refundCount: refunds._count,
    failedCount: failed._count,
    failedAmount: num(failed._sum.amount),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// KPI cards
// ─────────────────────────────────────────────────────────────────────────
export type KpiKey =
  | "organizations"
  | "users"
  | "subscriptions"
  | "revenue"
  | "tickets"
  | "uptime";

export type Kpi = {
  key: KpiKey;
  label: string;
  value: number | null;
  previous: number | null;
  delta: Delta | null;
  /** Which direction is "good" — drives trend colour (open tickets: down is good). */
  goodWhen: "up" | "down";
  kind: "count" | "currency" | "percent";
  href: string;
  /** Plain-English definition of the comparison, shown in a tooltip. */
  note: string;
  /** Set when the metric genuinely has no data source yet (e.g. uptime). */
  unavailableReason?: string;
};

export async function getUptime(range: DateRange) {
  const rows = await prisma.healthCheck.groupBy({
    by: ["ok"],
    where: { component: { in: ["database", "application"] }, checkedAt: { gte: range.from, lt: range.to } },
    _count: true,
  });
  const total = rows.reduce((s, r) => s + r._count, 0);
  if (total === 0) return null;
  const ok = rows.find((r) => r.ok)?._count ?? 0;
  return { pct: Math.round((ok / total) * 1000) / 10, samples: total };
}

export async function getKpis(range: DateRange): Promise<Kpi[]> {
  const prev = previousRange(range);
  const [
    orgNow,
    orgPrev,
    usersNow,
    usersPrev,
    subsNow,
    subsPrev,
    revNow,
    revPrev,
    ticketsNow,
    ticketsCarried,
    uptimeNow,
    uptimePrev,
  ] = await Promise.all([
    prisma.organization.count({ where: { createdAt: { lt: range.to } } }),
    prisma.organization.count({ where: { createdAt: { lt: range.from } } }),
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" }, createdAt: { lt: range.to } } }),
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" }, createdAt: { lt: range.from } } }),
    prisma.organizationSubscription.count({ where: { status: "ACTIVE", createdAt: { lt: range.to } } }),
    prisma.organizationSubscription.count({ where: { status: "ACTIVE", createdAt: { lt: range.from } } }),
    revenueTotals(range),
    revenueTotals(prev),
    prisma.supportTicket.count({ where: { status: { notIn: [...OPEN_TICKET_EXCLUDED] } } }),
    prisma.supportTicket.count({
      where: { status: { notIn: [...OPEN_TICKET_EXCLUDED] }, createdAt: { lt: range.from } },
    }),
    getUptime(range),
    getUptime(prev),
  ]);

  return [
    {
      key: "organizations",
      label: "Total Organizations",
      value: orgNow,
      previous: orgPrev,
      delta: computeDelta(orgNow, orgPrev),
      goodWhen: "up",
      kind: "count",
      href: "/admin/organizations",
      note: "Organizations created up to the end of the selected period vs. up to its start.",
    },
    {
      key: "users",
      label: "Total Users",
      value: usersNow,
      previous: usersPrev,
      delta: computeDelta(usersNow, usersPrev),
      goodWhen: "up",
      kind: "count",
      href: "/admin/users",
      note: "All non-Platform-Owner accounts created up to the end of the period vs. up to its start.",
    },
    {
      key: "subscriptions",
      label: "Active Subscriptions",
      value: subsNow,
      previous: subsPrev,
      delta: computeDelta(subsNow, subsPrev),
      goodWhen: "up",
      kind: "count",
      href: "/admin/revenue/subscriptions",
      note: "Subscriptions currently ACTIVE, by creation date. Historical status changes are not stored, so the comparison counts subscriptions that existed (and are still active) at the period start.",
    },
    {
      key: "revenue",
      label: "Monthly Revenue",
      value: revNow.net,
      previous: revPrev.net,
      delta: computeDelta(revNow.net, revPrev.net),
      goodWhen: "up",
      kind: "currency",
      href: "/admin/revenue",
      note: "Net revenue = settled payments minus processed refunds in the period, vs. the preceding period of equal length. Failed and cancelled payments are excluded.",
    },
    {
      key: "tickets",
      label: "Open Tickets",
      value: ticketsNow,
      previous: ticketsCarried,
      delta: computeDelta(ticketsNow, ticketsCarried),
      goodWhen: "down",
      kind: "count",
      href: "/admin/support",
      note: "Tickets not yet resolved, closed or cancelled, vs. the backlog carried in from before the period began.",
    },
    {
      key: "uptime",
      label: "System Uptime",
      value: uptimeNow?.pct ?? null,
      previous: uptimePrev?.pct ?? null,
      delta: uptimeNow && uptimePrev ? computeDelta(uptimeNow.pct, uptimePrev.pct) : null,
      goodWhen: "up",
      kind: "percent",
      href: "/admin/system/health",
      note: "Share of successful database + application health probes in the period.",
      unavailableReason: uptimeNow ? undefined : "Monitoring not configured",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Revenue overview
// ─────────────────────────────────────────────────────────────────────────
export type RevenuePoint = { bucket: string; net: number; gross: number; refunds: number };

export async function getRevenueOverview(range: DateRange, grouping: Grouping) {
  const prev = previousRange(range);
  const u = unitSql(grouping);
  const [grossRows, refundRows, now, before] = await Promise.all([
    prisma.$queryRaw<{ bucket: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc(${u}, "paidAt") AS bucket, SUM(amount) AS total
      FROM "Payment"
      WHERE status IN ${Prisma.raw(REVENUE_STATUS_SQL)}
        AND "paidAt" >= ${range.from} AND "paidAt" < ${range.to}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ bucket: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc(${u}, "processedAt") AS bucket, SUM(amount) AS total
      FROM "Refund"
      WHERE status = 'PROCESSED'
        AND "processedAt" >= ${range.from} AND "processedAt" < ${range.to}
      GROUP BY 1 ORDER BY 1`,
    revenueTotals(range),
    revenueTotals(prev),
  ]);

  const gross = densify(range, grouping, grossRows.map((r) => ({ bucket: r.bucket, value: num(r.total) })));
  const refunds = densify(range, grouping, refundRows.map((r) => ({ bucket: r.bucket, value: num(r.total) })));
  const series: RevenuePoint[] = gross.map((g, i) => ({
    bucket: g.bucket,
    gross: g.value,
    refunds: refunds[i].value,
    net: netRevenue(g.value, refunds[i].value),
  }));

  return { series, grouping, current: now, previous: before, delta: computeDelta(now.net, before.net) };
}

// ─────────────────────────────────────────────────────────────────────────
// User growth
// ─────────────────────────────────────────────────────────────────────────
export async function getUserGrowth(range: DateRange, grouping: Grouping) {
  const prev = previousRange(range);
  const u = unitSql(grouping);
  const [newRows, activeRows, totalNow, newNow, newPrev] = await Promise.all([
    prisma.$queryRaw<{ bucket: Date; total: bigint }[]>`
      SELECT date_trunc(${u}, "createdAt") AS bucket, COUNT(*) AS total
      FROM "User"
      WHERE role <> 'PLATFORM_OWNER' AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ bucket: Date; total: bigint }[]>`
      SELECT date_trunc(${u}, "lastLoginAt") AS bucket, COUNT(*) AS total
      FROM "User"
      WHERE role <> 'PLATFORM_OWNER' AND "lastLoginAt" >= ${range.from} AND "lastLoginAt" < ${range.to}
      GROUP BY 1 ORDER BY 1`,
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" }, createdAt: { lt: range.to } } }),
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" }, createdAt: { gte: range.from, lt: range.to } } }),
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" }, createdAt: { gte: prev.from, lt: prev.to } } }),
  ]);

  const created = densify(range, grouping, newRows.map((r) => ({ bucket: r.bucket, value: num(r.total) })));
  const active = densify(range, grouping, activeRows.map((r) => ({ bucket: r.bucket, value: num(r.total) })));
  return {
    series: created.map((c, i) => ({ bucket: c.bucket, newUsers: c.value, activeUsers: active[i].value })),
    grouping,
    totalUsers: totalNow,
    newUsers: newNow,
    previousNewUsers: newPrev,
    delta: computeDelta(newNow, newPrev),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Organizations by plan
// ─────────────────────────────────────────────────────────────────────────
export type PlanSlice = { planId: string | null; name: string; slug: string | null; count: number; pct: number };

export async function getOrganizationsByPlan(scope: "all" | "active" = "all") {
  const where: Prisma.OrganizationWhereInput =
    scope === "active" ? { status: { in: ["ACTIVE", "GRACE_PERIOD", "APPROVED"] } } : {};
  const [groups, plans] = await Promise.all([
    prisma.organization.groupBy({ by: ["planId"], where, _count: true }),
    prisma.subscriptionPlan.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  const byId = new Map(plans.map((p) => [p.id, p]));
  const total = groups.reduce((s, g) => s + g._count, 0);
  const slices: PlanSlice[] = groups
    .map((g) => {
      const p = g.planId ? byId.get(g.planId) : null;
      return {
        planId: g.planId,
        name: p?.name ?? "No plan",
        slug: p?.slug ?? null,
        count: g._count,
        pct: total ? Math.round((g._count / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
  return { total, slices };
}

// ─────────────────────────────────────────────────────────────────────────
// Top performing organizations
// ─────────────────────────────────────────────────────────────────────────
export type TopOrgSort = "revenue" | "users" | "growth" | "name";
export type TopOrgRow = {
  rank: number;
  id: string;
  name: string;
  plan: string | null;
  users: number;
  revenue: number;
  growthPct: number | null;
};

export async function getTopOrganizations(range: DateRange, sort: TopOrgSort = "revenue", planSlug?: string, limit = 5) {
  const prev = previousRange(range);
  const settled = [...REVENUE_PAYMENT_STATUSES];
  const [curTop, userTop] = await Promise.all([
    prisma.payment.groupBy({
      by: ["organizationId"],
      where: { organizationId: { not: null }, status: { in: settled }, paidAt: { gte: range.from, lt: range.to } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 50,
    }),
    prisma.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { not: null } },
      _count: true,
      orderBy: { _count: { organizationId: "desc" } },
      take: 50,
    }),
  ]);

  const ids = Array.from(
    new Set([...curTop.map((r) => r.organizationId!), ...userTop.map((r) => r.organizationId!)])
  );
  if (ids.length === 0) return [] as TopOrgRow[];

  const [orgs, prevRev, curRev, userCounts] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: ids }, ...(planSlug ? { plan: { slug: planSlug } } : {}) },
      select: { id: true, name: true, plan: { select: { name: true } } },
    }),
    prisma.payment.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, status: { in: settled }, paidAt: { gte: prev.from, lt: prev.to } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, status: { in: settled }, paidAt: { gte: range.from, lt: range.to } },
      _sum: { amount: true },
    }),
    prisma.user.groupBy({ by: ["organizationId"], where: { organizationId: { in: ids } }, _count: true }),
  ]);

  const prevMap = new Map(prevRev.map((r) => [r.organizationId, num(r._sum.amount)]));
  const curMap = new Map(curRev.map((r) => [r.organizationId, num(r._sum.amount)]));
  const userMap = new Map(userCounts.map((r) => [r.organizationId, r._count]));

  const rows = orgs.map((o) => {
    const revenue = curMap.get(o.id) ?? 0;
    const before = prevMap.get(o.id) ?? 0;
    const d = computeDelta(revenue, before);
    return {
      id: o.id,
      name: o.name,
      plan: o.plan?.name ?? null,
      users: userMap.get(o.id) ?? 0,
      revenue,
      growthPct: d.pct,
    };
  });

  const cmp: Record<TopOrgSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    revenue: (a, b) => b.revenue - a.revenue,
    users: (a, b) => b.users - a.users,
    growth: (a, b) => (b.growthPct ?? -Infinity) - (a.growthPct ?? -Infinity),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return rows
    .sort(cmp[sort])
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ─────────────────────────────────────────────────────────────────────────
// Recent support tickets
// ─────────────────────────────────────────────────────────────────────────
export async function getRecentTickets(limit = 6) {
  const rows = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      updatedAt: true,
      organization: { select: { name: true } },
      client: { select: { company: true, name: true } },
      assignedAgent: { select: { user: { select: { name: true } } } },
      assignedITSupport: { select: { name: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    updatedAt: t.updatedAt,
    organization: t.organization?.name ?? t.client?.company ?? t.client?.name ?? "ABYVORA direct",
    assignee: t.assignedAgent?.user?.name ?? t.assignedITSupport?.name ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Recent activities (from the audit log)
// ─────────────────────────────────────────────────────────────────────────
export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: ActivityTone;
  at: Date;
  failed: boolean;
};

export async function getRecentActivities(limit = 7): Promise<ActivityItem[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      description: true,
      actorName: true,
      entityType: true,
      status: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  });
  return rows.map((r) => {
    const d = describeAction(r.action);
    const parts = [r.description, r.organization?.name, r.actorName && `by ${r.actorName}`].filter(Boolean);
    return {
      id: r.id,
      title: d.title,
      detail: parts.length ? (parts as string[]).join(" · ") : r.entityType,
      tone: r.status === "FAILED" ? "danger" : d.tone,
      at: r.createdAt,
      failed: r.status === "FAILED",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Department overview (ABYVORA internal departments: organizationId = null)
// ─────────────────────────────────────────────────────────────────────────
export type DepartmentRow = {
  id: string;
  name: string;
  employees: number;
  active: number;
  /** % of active employees currently holding ≥1 open assigned ticket. */
  workloadPct: number;
};

export async function getDepartmentOverview(): Promise<DepartmentRow[]> {
  const [departments, openTickets] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, members: { select: { id: true, status: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { status: { notIn: [...OPEN_TICKET_EXCLUDED] } },
      select: { assignedITSupportId: true, assignedAgent: { select: { userId: true } } },
    }),
  ]);
  const busy = new Set<string>();
  for (const t of openTickets) {
    if (t.assignedITSupportId) busy.add(t.assignedITSupportId);
    if (t.assignedAgent?.userId) busy.add(t.assignedAgent.userId);
  }
  return departments.map((d) => {
    const active = d.members.filter((m) => m.status === "ACTIVE");
    const busyCount = active.filter((m) => busy.has(m.id)).length;
    return {
      id: d.id,
      name: d.name,
      employees: d.members.length,
      active: active.length,
      workloadPct: active.length ? Math.round((busyCount / active.length) * 100) : 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Revenue by service (Project.projectType of the project each payment settled)
// ─────────────────────────────────────────────────────────────────────────
export async function getRevenueByService(range: DateRange, limit = 6) {
  const rows = await prisma.$queryRaw<{ service: string; revenue: Prisma.Decimal; payments: bigint }[]>`
    SELECT pr."projectType" AS service, SUM(p.amount) AS revenue, COUNT(*) AS payments
    FROM "Payment" p
    JOIN "Project" pr ON pr.id = p."projectId"
    WHERE p.status IN ${Prisma.raw(REVENUE_STATUS_SQL)}
      AND p."paidAt" >= ${range.from} AND p."paidAt" < ${range.to}
    GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`;
  const total = rows.reduce((s, r) => s + num(r.revenue), 0);
  return {
    total,
    rows: rows.map((r) => ({
      service: r.service,
      revenue: num(r.revenue),
      payments: num(r.payments),
      pct: total ? Math.round((num(r.revenue) / total) * 1000) / 10 : 0,
    })),
  };
}
