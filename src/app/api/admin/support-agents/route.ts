import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest, conflict } from "@/lib/admin/api";
import { createUserAccount, UserCreateError } from "@/lib/admin/user-accounts";
import { supportAgentSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

/** Adds an ABYVORA-internal support person: an AGENT (with agent profile) or IT_SUPPORT account. */
export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const d = supportAgentSchema.parse(await req.json());
    try {
      const { user, password } = await createUserAccount({ name: d.name, email: d.email, phone: d.phone, role: d.type, departmentId: d.departmentId });
      await writeAuditLog({
        actorId: session.user.id, actorRole: session.user.role, action: "user.created", entityType: "User", entityId: user.id,
        description: `Platform Owner added support ${d.type === "AGENT" ? "agent" : "IT specialist"} ${user.email}`, newValue: { role: user.role },
      });
      return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role }, temporaryPassword: password }, { status: 201 });
    } catch (e) {
      if (e instanceof UserCreateError) return e.status === 409 ? conflict(e.message) : badRequest(e.message);
      throw e;
    }
  });
}
