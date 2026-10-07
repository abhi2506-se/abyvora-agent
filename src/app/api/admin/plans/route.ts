import { NextRequest, NextResponse } from "next/server";
import { apiGuard, conflict } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { planSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  return apiGuard(async () => {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" }, include: { _count: { select: { organizations: true } } } });
    return NextResponse.json({ plans });
  });
}

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const d = planSchema.parse(await req.json());
    if (await prisma.subscriptionPlan.findUnique({ where: { slug: d.slug } })) return conflict("A plan with that slug already exists");
    const plan = await prisma.subscriptionPlan.create({
      data: { name: d.name, slug: d.slug, priceMonthly: d.priceMonthly, priceYearly: d.priceYearly ?? null, features: d.features, active: d.active },
    });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "plan.created", entityType: "SubscriptionPlan", entityId: plan.id,
      description: `Platform Owner created plan "${plan.name}"`, newValue: { priceMonthly: d.priceMonthly, features: d.features },
    });
    return NextResponse.json({ plan }, { status: 201 });
  });
}
