import { NextRequest, NextResponse } from "next/server";
import { apiGuard, conflict, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { planUpdateSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const d = planUpdateSchema.parse(await req.json());
    const before = await prisma.subscriptionPlan.findUnique({ where: { id }, include: { _count: { select: { organizations: true } } } });
    if (!before) return notFound("Plan not found");
    if (d.slug && d.slug !== before.slug && before._count.organizations > 0) return conflict("Slug cannot change while organizations are on this plan");
    if (d.slug && d.slug !== before.slug && (await prisma.subscriptionPlan.findUnique({ where: { slug: d.slug } }))) return conflict("A plan with that slug already exists");
    if (d.active === false && before._count.organizations > 0) {
      // Allowed (existing orgs keep it) but recorded: inactive plans just stop being selectable.
    }
    const data = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "plan.updated", entityType: "SubscriptionPlan", entityId: id,
      description: `Platform Owner updated plan "${plan.name}"`,
      previousValue: { priceMonthly: Number(before.priceMonthly), features: before.features, active: before.active }, newValue: data,
    });
    return NextResponse.json({ plan });
  });
}
