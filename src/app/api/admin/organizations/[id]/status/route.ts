import { NextRequest, NextResponse } from "next/server";
import { apiGuard, conflict, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { orgStatusSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";
import { clearMemo } from "@/lib/admin/memo";

const ALLOWED_FROM: Record<string, string[]> = {
  suspend: ["ACTIVE", "GRACE_PERIOD"],
  reactivate: ["SUSPENDED", "GRACE_PERIOD"],
  terminate: ["ACTIVE", "GRACE_PERIOD", "SUSPENDED", "APPROVED"],
};
const TARGET = { suspend: "SUSPENDED", reactivate: "ACTIVE", terminate: "TERMINATED" } as const;

/**
 * Suspend / reactivate / terminate. Org users are blocked at sign-in while the
 * org is SUSPENDED or TERMINATED (see lib/auth.ts authorize). The linked
 * subscription is moved in lock-step so billing state never disagrees.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const { action, reason } = orgStatusSchema.parse(await req.json());
    const org = await prisma.organization.findUnique({ where: { id }, include: { subscription: true } });
    if (!org) return notFound("Organization not found");
    if (!ALLOWED_FROM[action].includes(org.status)) return conflict(`Cannot ${action} an organization that is ${org.status}`);

    const target = TARGET[action];
    await prisma.$transaction([
      prisma.organization.update({ where: { id }, data: { status: target } }),
      ...(org.subscription
        ? [prisma.organizationSubscription.update({
            where: { organizationId: id },
            data: { status: target === "ACTIVE" ? "ACTIVE" : target, gracePeriodEndsAt: target === "ACTIVE" ? null : org.subscription.gracePeriodEndsAt },
          })]
        : []),
    ]);

    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: id, action: `organization.${action === "reactivate" ? "reactivated" : action === "suspend" ? "suspended" : "terminated"}`,
      entityType: "Organization", entityId: id, description: `${action} "${org.name}": ${reason}`,
      previousValue: { status: org.status }, newValue: { status: target, reason },
    });
    clearMemo("nav-counts");
    return NextResponse.json({ status: target });
  });
}
