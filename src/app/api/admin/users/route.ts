import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, conflict } from "@/lib/admin/api";
import { createUserAccount, UserCreateError } from "@/lib/admin/user-accounts";
import { createUserSchema } from "@/lib/admin/schemas";
import { listUsers } from "@/lib/admin/lists";
import { oneOf, parsePage } from "@/lib/admin/paging";
import { writeAuditLog } from "@/lib/audit";

const ROLES = ["ADMIN","AGENT","CLIENT","IT_SUPPORT","PLATFORM_OWNER","ORG_OWNER","ORG_ADMIN","HIGHER_MANAGER","MID_MANAGER","LOWER_MANAGER","HR","EMPLOYEE"] as const;

export async function GET(req: NextRequest) {
  return apiGuard(async () => {
    const sp = req.nextUrl.searchParams;
    const data = await listUsers({
      q: sp.get("q") ?? undefined,
      role: oneOf(sp.get("role") ?? undefined, ROLES),
      status: oneOf(sp.get("status") ?? undefined, ["ACTIVE", "DISABLED", "INVITED"] as const),
      page: parsePage(sp.get("page") ?? undefined),
    });
    return NextResponse.json(data);
  });
}

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const data = createUserSchema.parse(await req.json());
    try {
      const { user, password } = await createUserAccount(data);
      await writeAuditLog({
        actorId: session.user.id, actorRole: session.user.role, organizationId: user.organizationId,
        action: "user.created", entityType: "User", entityId: user.id,
        description: `Platform Owner created ${user.role} account for ${user.email}`, newValue: { role: user.role, organizationId: user.organizationId },
      });
      return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role }, temporaryPassword: password }, { status: 201 });
    } catch (e) {
      if (e instanceof UserCreateError) return e.status === 409 ? conflict(e.message) : badRequest(e.message);
      throw e;
    }
  });
}
