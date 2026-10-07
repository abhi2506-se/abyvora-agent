import { NextRequest, NextResponse } from "next/server";
import { apiGuard, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { updateOrganizationSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async () => {
    const { id } = await params;
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { plan: true, subscription: { include: { plan: true } }, _count: { select: { users: true, clients: true, projects: true, payments: true, invoices: true, supportTickets: true } } },
    });
    return org ? NextResponse.json({ organization: org }) : notFound("Organization not found");
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const patch = updateOrganizationSchema.parse(await req.json());
    const before = await prisma.organization.findUnique({ where: { id } });
    if (!before) return notFound("Organization not found");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === "" ? null : v]));
    const after = await prisma.organization.update({ where: { id }, data: clean });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: id, action: "organization.updated",
      entityType: "Organization", entityId: id, description: `Platform Owner updated "${after.name}"`,
      previousValue: Object.fromEntries(Object.keys(clean).map((k) => [k, (before as Record<string, unknown>)[k]])), newValue: clean,
    });
    return NextResponse.json({ organization: after });
  });
}
