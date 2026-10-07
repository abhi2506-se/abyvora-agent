import { Prisma } from "@prisma/client";
import type {
  OrganizationStatus,
  PaymentStatus,
  RefundStatus,
  Role,
  SubscriptionAccessStatus,
  SupportPriority,
  SupportTicketStatus,
  UserStatus,
  InvoicePaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, pageArgs } from "@/lib/admin/paging";
import { breachedWhere } from "@/lib/admin/sla";

/**
 * Paginated, filterable list loaders for the Platform Owner console. All are
 * platform-wide and must only be called after requirePlatformOwner(). Filters
 * accept only enum-validated values + free-text `q`; nothing client-supplied is
 * ever interpolated as an organizationId scope.
 */
const OPEN = ["RESOLVED", "CLOSED", "CANCELLED"] as const;
const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

// ── Organizations ──────────────────────────────────────────────────────────
export type OrgListFilter = {
  q?: string;
  status?: OrganizationStatus | OrganizationStatus[];
  planSlug?: string;
  sort?: "name" | "createdAt";
  dir?: "asc" | "desc";
  page: number;
};

export async function listOrganizations(f: OrgListFilter) {
  const where: Prisma.OrganizationWhereInput = {
    ...(f.status ? { status: Array.isArray(f.status) ? { in: f.status } : f.status } : {}),
    ...(f.planSlug ? { plan: { slug: f.planSlug } } : {}),
    ...(f.q ? { OR: [{ name: ci(f.q) }, { slug: ci(f.q) }, { contactEmail: ci(f.q) }, { industry: ci(f.q) }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      ...pageArgs(f.page),
      orderBy: { [f.sort ?? "createdAt"]: f.dir ?? "desc" },
      select: {
        id: true, name: true, slug: true, industry: true, status: true, contactEmail: true, createdAt: true, approvedAt: true,
        plan: { select: { name: true, slug: true } },
        subscription: { select: { status: true, currentPeriodEnd: true } },
        _count: { select: { users: true, projects: true } },
      },
    }),
  ]);
  return { total, rows };
}

// ── Users ──────────────────────────────────────────────────────────────────
export type UserListFilter = {
  q?: string; role?: Role; status?: UserStatus; organizationId?: string; departmentId?: string;
  internalOnly?: boolean; page: number; sort?: "createdAt" | "name" | "lastLoginAt"; dir?: "asc" | "desc";
};

export async function listUsers(f: UserListFilter) {
  const where: Prisma.UserWhereInput = {
    ...(f.role ? { role: f.role } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.organizationId ? { organizationId: f.organizationId } : {}),
    ...(f.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.internalOnly ? { organizationId: null } : {}),
    ...(f.q ? { OR: [{ name: ci(f.q) }, { email: ci(f.q) }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      ...pageArgs(f.page),
      orderBy: { [f.sort ?? "createdAt"]: f.dir ?? "desc" },
      select: {
        id: true, name: true, email: true, role: true, status: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
        organization: { select: { id: true, name: true } },
        department: { select: { name: true } },
        team: { select: { name: true } },
        manager: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

// ── Support tickets ────────────────────────────────────────────────────────
export type TicketView = "all" | "unassigned" | "mine" | "escalated" | "resolved" | "breached";
export type TicketListFilter = {
  view: TicketView; q?: string; status?: SupportTicketStatus; priority?: SupportPriority;
  organizationId?: string; page: number; userId?: string; take?: number;
};

export function ticketWhere(f: Omit<TicketListFilter, "page">): Prisma.SupportTicketWhereInput {
  const open = { notIn: [...OPEN] as SupportTicketStatus[] };
  const base: Prisma.SupportTicketWhereInput =
    f.view === "unassigned"
      ? { status: open, assignedAgentId: null, assignedITSupportId: null }
      : f.view === "escalated"
        ? { status: "ESCALATED_TO_ADMIN" }
        : f.view === "resolved"
          ? { status: { in: ["RESOLVED", "CLOSED"] } }
          : f.view === "breached"
            ? breachedWhere()
            : f.view === "mine"
              ? { OR: [{ raisedById: f.userId ?? "__none__" }, { assignedITSupportId: f.userId ?? "__none__" }] }
              : {};
  return {
    AND: [
      base,
      f.status ? { status: f.status } : {},
      f.priority ? { priority: f.priority } : {},
      f.organizationId ? { organizationId: f.organizationId } : {},
      f.q ? { OR: [{ ticketNumber: ci(f.q) }, { title: ci(f.q) }] } : {},
    ],
  };
}

export async function listTickets(f: TicketListFilter) {
  const where = ticketWhere(f);
  const [total, rows] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      ...(f.take ? { take: f.take, skip: 0 } : pageArgs(f.page)),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true, category: true, createdAt: true, updatedAt: true,
        organization: { select: { id: true, name: true } },
        client: { select: { company: true, name: true } },
        assignedAgent: { select: { user: { select: { name: true } } } },
        assignedITSupport: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

// ── Payments / refunds / invoices / subscriptions ──────────────────────────
export async function listPayments(f: { q?: string; status?: PaymentStatus; page: number; organizationId?: string }) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.organizationId ? { organizationId: f.organizationId } : {}),
    ...(f.q ? { OR: [{ providerPaymentId: ci(f.q) }, { providerOrderId: ci(f.q) }, { receipt: ci(f.q) }, { client: { name: ci(f.q) } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where, ...pageArgs(f.page), orderBy: { createdAt: "desc" },
      select: {
        id: true, amount: true, currency: true, status: true, paymentMethod: true, provider: true, providerPaymentId: true,
        paidAt: true, createdAt: true, failureReason: true,
        organization: { select: { name: true } },
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function listRefunds(f: { status?: RefundStatus; page: number; q?: string }) {
  const where: Prisma.RefundWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.q ? { OR: [{ providerRefundId: ci(f.q) }, { client: { name: ci(f.q) } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where, ...pageArgs(f.page), orderBy: { requestedAt: "desc" },
      select: {
        id: true, amount: true, currency: true, status: true, reason: true, requestedAt: true, processedAt: true, providerRefundId: true,
        organization: { select: { name: true } },
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function listInvoices(f: { q?: string; status?: InvoicePaymentStatus; page: number; organizationId?: string }) {
  const where: Prisma.InvoiceWhereInput = {
    ...(f.organizationId ? { organizationId: f.organizationId } : {}),
    ...(f.status ? { paymentStatus: f.status } : {}),
    ...(f.q ? { OR: [{ invoiceNumber: ci(f.q) }, { billingName: ci(f.q) }, { billingEmail: ci(f.q) }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where, ...pageArgs(f.page), orderBy: { issuedAt: "desc" },
      select: {
        id: true, invoiceNumber: true, billingName: true, total: true, paidAmount: true, currency: true, paymentStatus: true, issuedAt: true, dueAt: true,
        organization: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function listSubscriptions(f: { status?: SubscriptionAccessStatus; planId?: string; page: number; q?: string }) {
  const where: Prisma.OrganizationSubscriptionWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.planId ? { planId: f.planId } : {}),
    ...(f.q ? { organization: { name: ci(f.q) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.organizationSubscription.count({ where }),
    prisma.organizationSubscription.findMany({
      where, ...pageArgs(f.page), orderBy: { currentPeriodEnd: "asc" },
      select: {
        id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, gracePeriodEndsAt: true, cancelAtPeriodEnd: true,
        organization: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, priceMonthly: true, currency: true } },
      },
    }),
  ]);
  return { total, rows };
}

// ── Audit logs ─────────────────────────────────────────────────────────────
export type AuditFilter = {
  q?: string; status?: "SUCCESS" | "FAILED"; entityType?: string; organizationId?: string;
  from?: Date; to?: Date; page: number; actionPrefix?: string; take?: number; onlyOrganizations?: boolean;
};

export function auditWhere(f: Omit<AuditFilter, "page" | "take">): Prisma.AuditLogWhereInput {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.organizationId ? { organizationId: f.organizationId } : f.onlyOrganizations ? { organizationId: { not: null } } : {}),
    ...(f.actionPrefix ? { action: { startsWith: f.actionPrefix } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    ...(f.q ? { OR: [{ action: ci(f.q) }, { actorName: ci(f.q) }, { actorEmail: ci(f.q) }, { description: ci(f.q) }, { entityId: ci(f.q) }] } : {}),
  };
}

export async function listAuditLogs(f: AuditFilter) {
  const where = auditWhere(f);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, ...(f.take ? { take: f.take, skip: 0 } : pageArgs(f.page)), orderBy: { createdAt: "desc" },
      select: {
        id: true, action: true, entityType: true, entityId: true, description: true, actorName: true, actorEmail: true, actorRole: true,
        status: true, errorDetail: true, ipAddress: true, createdAt: true,
        organization: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows };
}

export const LIST_PAGE_SIZE = PAGE_SIZE;
