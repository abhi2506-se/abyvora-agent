import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, conflict } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { departmentSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  return apiGuard(async () => {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, organizationId: true, organization: { select: { name: true } }, _count: { select: { members: true } } },
    });
    return NextResponse.json({ departments });
  });
}

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const d = departmentSchema.parse(await req.json());
    if (d.organizationId && !(await prisma.organization.findUnique({ where: { id: d.organizationId }, select: { id: true } }))) return badRequest("Organization not found");
    const dup = await prisma.department.findFirst({ where: { organizationId: d.organizationId ?? null, name: { equals: d.name, mode: "insensitive" } } });
    if (dup) return conflict("A department with that name already exists in this scope");
    const dept = await prisma.department.create({ data: { name: d.name, organizationId: d.organizationId ?? null } });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: dept.organizationId, action: "department.created",
      entityType: "Department", entityId: dept.id, description: `Platform Owner created department "${dept.name}"`,
    });
    return NextResponse.json({ department: dept }, { status: 201 });
  });
}
