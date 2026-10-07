import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, conflict, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const patch = updateUserSchema.parse(await req.json());
    if (id === session.user.id) return badRequest("You cannot change your own role or status here");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound("User not found");
    if (target.role === "PLATFORM_OWNER") return conflict("Platform Owner accounts cannot be modified from the console");

    if (patch.role && (patch.role === "ADMIN" || patch.role === "IT_SUPPORT") && target.organizationId) {
      return badRequest(`${patch.role} is an ABYVORA-internal role; the user belongs to an organization`);
    }
    // Reassignments must stay inside the user's own tenant.
    const tenant = { organizationId: target.organizationId };
    if (patch.departmentId && !(await prisma.department.findFirst({ where: { id: patch.departmentId, ...tenant } }))) return badRequest("Department is not in this user's organization");
    if (patch.teamId && !(await prisma.team.findFirst({ where: { id: patch.teamId, ...tenant } }))) return badRequest("Team is not in this user's organization");
    if (patch.managerId) {
      if (patch.managerId === id) return badRequest("A user cannot manage themselves");
      if (!(await prisma.user.findFirst({ where: { id: patch.managerId, ...tenant } }))) return badRequest("Manager is not in this user's organization");
    }

    const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const updated = await prisma.user.update({ where: { id }, data });
    const roleChanged = patch.role && patch.role !== target.role;
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: target.organizationId,
      action: roleChanged ? "user.role_changed" : patch.status ? "user.status_changed" : "user.updated",
      entityType: "User", entityId: id, description: `Platform Owner updated ${target.email}`,
      previousValue: Object.fromEntries(Object.keys(data).map((k) => [k, (target as Record<string, unknown>)[k]])), newValue: data,
    });
    return NextResponse.json({ user: { id: updated.id, role: updated.role, status: updated.status } });
  });
}
