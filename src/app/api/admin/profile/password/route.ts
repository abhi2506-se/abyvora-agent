import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiGuard, badRequest } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/admin/schemas";
import { isWeakPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const rl = checkRateLimit(`pw-change:${session.user.id}`, 5, 15 * 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const { currentPassword, newPassword } = changePasswordSchema.parse(await req.json());
    if (isWeakPassword(newPassword)) return badRequest("Password must contain at least one letter and one number");

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      await writeAuditLog({
        actorId: session.user.id, actorRole: session.user.role, action: "security.password_change_failed",
        entityType: "User", entityId: session.user.id, status: "FAILED", errorDetail: "Current password incorrect",
      });
      return badRequest("Current password is incorrect");
    }
    await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "security.password_changed",
      entityType: "User", entityId: session.user.id, description: "Platform Owner changed their password",
    });
    return NextResponse.json({ ok: true });
  });
}
