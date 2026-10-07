import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { subscriptionChangeSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

const ORG_STATUS_FOR: Record<string, "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "TERMINATED" | null> = {
  ACTIVE: "ACTIVE", GRACE_PERIOD: "GRACE_PERIOD", SUSPENDED: "SUSPENDED", TERMINATED: "TERMINATED", PAYMENT_DUE: null,
};

/** Plan change (upgrade/downgrade), grace period, suspension, termination, cancel-at-period-end. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const body = subscriptionChangeSchema.parse(await req.json());
    const org = await prisma.organization.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!org) return notFound("Organization not found");

    let newPlan = null;
    if (body.planId) {
      newPlan = await prisma.subscriptionPlan.findFirst({ where: { id: body.planId, active: true } });
      if (!newPlan) return badRequest("Plan not found or inactive");
      // Downgrade guard: never move an org onto a plan whose user cap it already exceeds.
      const cap = (newPlan.features as Record<string, unknown>)?.maxUsers;
      if (typeof cap === "number") {
        const users = await prisma.user.count({ where: { organizationId: id } });
        if (users > cap) return badRequest(`Organization has ${users} users; ${newPlan.name} allows ${cap}`);
      }
    }
    if (!org.subscription && !newPlan) return badRequest("Organization has no subscription — choose a plan to create one");

    const now = new Date();
    const data = {
      ...(newPlan ? { planId: newPlan.id } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: body.cancelAtPeriodEnd } : {}),
      ...(body.status === "GRACE_PERIOD" ? { gracePeriodEndsAt: new Date(now.getTime() + (body.graceDays ?? 7) * 86400000) } : {}),
      ...(body.status === "ACTIVE" ? { gracePeriodEndsAt: null } : {}),
    };

    const sub = org.subscription
      ? await prisma.organizationSubscription.update({ where: { organizationId: id }, data })
      : await prisma.organizationSubscription.create({
          data: { organizationId: id, planId: newPlan!.id, status: body.status ?? "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000) },
        });

    const orgStatus = body.status ? ORG_STATUS_FOR[body.status] : null;
    await prisma.organization.update({ where: { id }, data: { ...(newPlan ? { planId: newPlan.id } : {}), ...(orgStatus ? { status: orgStatus } : {}) } });

    const prevPrice = Number(org.subscription?.plan.priceMonthly ?? 0);
    const kind = newPlan ? (Number(newPlan.priceMonthly) >= prevPrice ? "upgraded" : "downgraded") : "updated";
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: id, action: `subscription.${kind}`,
      entityType: "OrganizationSubscription", entityId: sub.id,
      description: `Subscription ${kind} for "${org.name}"${newPlan ? ` → ${newPlan.name}` : ""}${body.status ? ` (${body.status})` : ""}`,
      previousValue: { planId: org.subscription?.planId, status: org.subscription?.status }, newValue: data,
    });
    return NextResponse.json({ subscription: sub });
  });
}
