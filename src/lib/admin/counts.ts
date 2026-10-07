import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/admin/memo";
import type { BadgeKey } from "@/lib/admin/nav";

const OPEN = { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] as ("RESOLVED" | "CLOSED" | "CANCELLED")[] };

/** Live sidebar badge counts. Cached 20s so every navigation doesn't re-count. */
export async function getNavCounts(): Promise<Record<BadgeKey, number>> {
  return memo("nav-counts", 20_000, async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [orgRequests, orgApprovals, complaints, unassigned, auditAlerts] = await Promise.all([
      prisma.organization.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.organization.count({ where: { status: { in: ["CHANGES_REQUESTED", "APPROVED"] } } }),
      prisma.supportTicket.count({ where: { status: OPEN } }),
      prisma.supportTicket.count({
        where: { status: OPEN, assignedAgentId: null, assignedITSupportId: null },
      }),
      prisma.auditLog.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    ]);
    return { orgRequests, orgApprovals, complaints, unassigned, auditAlerts };
  });
}
