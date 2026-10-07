import { prisma } from "@/lib/prisma";
import { breachedWhere } from "@/lib/admin/sla";

export type AlertSeverity = "info" | "warning" | "critical";
export type LiveAlert = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  severity: AlertSeverity;
  count: number;
};

/**
 * "Needs attention" alerts computed live from real state (not stored), so they
 * can never go stale or be fabricated: each appears only while its underlying
 * condition is true and disappears when it's resolved.
 */
export async function getLiveAlerts(): Promise<LiveAlert[]> {
  const now = new Date();
  const day = new Date(now.getTime() - 24 * 3600 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const open = { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] as ("RESOLVED" | "CLOSED" | "CANCELLED")[] };

  const [orgReq, critical, escalated, sla, failedPay, refundReq, subIssues, security, lastProbe] = await Promise.all([
    prisma.organization.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.supportTicket.count({ where: { priority: "HIGH", status: open } }),
    prisma.supportTicket.count({ where: { status: "ESCALATED_TO_ADMIN" } }),
    prisma.supportTicket.count({ where: breachedWhere(now) }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    prisma.refund.count({ where: { status: "REQUESTED" } }),
    prisma.organizationSubscription.count({ where: { status: { in: ["PAYMENT_DUE", "GRACE_PERIOD", "SUSPENDED"] } } }),
    prisma.auditLog.count({ where: { status: "FAILED", createdAt: { gte: day } } }),
    prisma.healthCheck.findFirst({ orderBy: { checkedAt: "desc" }, select: { ok: true, component: true } }),
  ]);

  const out: LiveAlert[] = [];
  const add = (a: Omit<LiveAlert, "id"> & { cond: boolean }) => {
    if (a.cond) out.push({ id: `live:${a.type}`, type: a.type, title: a.title, body: a.body, href: a.href, severity: a.severity, count: a.count });
  };
  add({ cond: orgReq > 0, type: "organization_request", title: "Organization requests awaiting review", body: `${orgReq} pending`, href: "/admin/organizations/requests", severity: "info", count: orgReq });
  add({ cond: critical > 0, type: "critical_ticket", title: "Critical support tickets open", body: `${critical} high-priority`, href: "/admin/support", severity: "critical", count: critical });
  add({ cond: escalated > 0, type: "escalated_ticket", title: "Escalated tickets need a decision", body: `${escalated} escalated`, href: "/admin/support/escalated", severity: "warning", count: escalated });
  add({ cond: sla > 0, type: "sla_breach", title: "SLA breached", body: `${sla} ticket${sla === 1 ? "" : "s"} past resolution target`, href: "/admin/support/sla", severity: "critical", count: sla });
  add({ cond: failedPay > 0, type: "payment_failure", title: "Payment failures (7 days)", body: `${failedPay} failed`, href: "/admin/revenue/transactions?status=FAILED", severity: "warning", count: failedPay });
  add({ cond: refundReq > 0, type: "refund_request", title: "Refund requests awaiting approval", body: `${refundReq} requested`, href: "/admin/revenue/refunds?status=REQUESTED", severity: "warning", count: refundReq });
  add({ cond: subIssues > 0, type: "subscription_event", title: "Subscriptions need attention", body: `${subIssues} payment due / grace / suspended`, href: "/admin/revenue/subscriptions", severity: "warning", count: subIssues });
  add({ cond: security > 0, type: "security_event", title: "Failed / blocked actions (24h)", body: `${security} event${security === 1 ? "" : "s"}`, href: "/admin/system/audit-logs?status=FAILED", severity: "critical", count: security });
  add({ cond: !!lastProbe && !lastProbe.ok, type: "health_alert", title: "System health check failing", body: `Latest probe failed: ${lastProbe?.component}`, href: "/admin/system/health", severity: "critical", count: 1 });
  return out;
}

export async function getNotificationFeed(userId: string) {
  const [stored, storedUnread, live] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, title: true, body: true, read: true, createdAt: true, metadata: true },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    getLiveAlerts(),
  ]);
  return { stored, live, unreadCount: storedUnread + live.length };
}
