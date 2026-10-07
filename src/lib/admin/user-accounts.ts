import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tempPassword } from "@/lib/admin/api";

export class UserCreateError extends Error {
  constructor(message: string, public status: 400 | 409 = 400) {
    super(message);
  }
}

/** ABYVORA-internal roles must NOT belong to a customer organization. */
const INTERNAL_ONLY: Role[] = ["ADMIN", "IT_SUPPORT"];
/** Roles that only make sense inside a customer organization. */
const ORG_REQUIRED: Role[] = ["ORG_OWNER", "ORG_ADMIN", "HIGHER_MANAGER", "MID_MANAGER", "LOWER_MANAGER", "HR", "EMPLOYEE"];

export async function createUserAccount(input: {
  name: string; email: string; phone?: string; role: Role;
  organizationId?: string; departmentId?: string; teamId?: string; managerId?: string;
}) {
  if (input.role === "PLATFORM_OWNER") throw new UserCreateError("Platform Owner accounts cannot be created here");
  const email = input.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new UserCreateError("A user with this email already exists", 409);

  if (INTERNAL_ONLY.includes(input.role) && input.organizationId) throw new UserCreateError(`${input.role} is an ABYVORA-internal role and cannot belong to an organization`);
  if (ORG_REQUIRED.includes(input.role) && !input.organizationId) throw new UserCreateError(`${input.role} requires an organization`);

  let organizationId: string | null = null;
  if (input.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, status: true, plan: { select: { name: true, features: true } } },
    });
    if (!org) throw new UserCreateError("Organization not found");
    if (org.status === "TERMINATED" || org.status === "REJECTED") throw new UserCreateError(`Cannot add users to a ${org.status} organization`);
    // Server-side plan entitlement: maxUsers is enforced here, not in the UI.
    const cap = (org.plan?.features as Record<string, unknown> | null)?.maxUsers;
    if (typeof cap === "number") {
      const count = await prisma.user.count({ where: { organizationId: org.id } });
      if (count >= cap) throw new UserCreateError(`${org.plan?.name ?? "Plan"} allows ${cap} users — this organization is at its limit`, 409);
    }
    organizationId = org.id;
  }

  // Department / team / manager must live in the SAME tenant as the new user.
  const sameTenant = { organizationId };
  if (input.departmentId && !(await prisma.department.findFirst({ where: { id: input.departmentId, ...sameTenant } }))) throw new UserCreateError("Department is not in this organization");
  if (input.teamId && !(await prisma.team.findFirst({ where: { id: input.teamId, ...sameTenant } }))) throw new UserCreateError("Team is not in this organization");
  if (input.managerId && !(await prisma.user.findFirst({ where: { id: input.managerId, ...sameTenant } }))) throw new UserCreateError("Manager is not in this organization");

  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: input.name, email, phone: input.phone || null, role: input.role, status: "ACTIVE", passwordHash, organizationId,
        departmentId: input.departmentId || null, teamId: input.teamId || null, managerId: input.managerId || null,
      },
    });
    if (input.role === "AGENT") await tx.agent.create({ data: { userId: u.id } });
    if (input.role === "CLIENT") await tx.client.create({ data: { userId: u.id, name: u.name, email: u.email, phone: u.phone, organizationId } });
    return u;
  });
  return { user, password };
}
