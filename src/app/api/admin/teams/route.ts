import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, conflict } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { teamSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const d = teamSchema.parse(await req.json());
    const organizationId = d.organizationId ?? null;
    if (organizationId && !(await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) return badRequest("Organization not found");
    if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId } }))) return badRequest("Department is not in this scope");
    if (await prisma.team.findFirst({ where: { organizationId, name: { equals: d.name, mode: "insensitive" } } })) return conflict("A team with that name already exists in this scope");
    const team = await prisma.team.create({ data: { name: d.name, departmentId: d.departmentId ?? null, organizationId } });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId, action: "team.created",
      entityType: "Team", entityId: team.id, description: `Platform Owner created team "${team.name}"`,
    });
    return NextResponse.json({ team }, { status: 201 });
  });
}
