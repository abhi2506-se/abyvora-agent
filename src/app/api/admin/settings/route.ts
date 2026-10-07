import { NextRequest, NextResponse } from "next/server";
import { apiGuard } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, settingsSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  return apiGuard(async () => {
    const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    return NextResponse.json({ values: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  });
}

/** Only allow-listed keys can be written — arbitrary Setting keys (API keys etc.) are untouchable here. */
export async function PUT(req: NextRequest) {
  return apiGuard(async (session) => {
    const { values } = settingsSchema.parse(await req.json());
    const keys = Object.keys(values);
    const before = await prisma.setting.findMany({ where: { key: { in: keys } } });
    await prisma.$transaction(
      keys.map((key) => prisma.setting.upsert({ where: { key }, create: { key, value: values[key] as never }, update: { value: values[key] as never } }))
    );
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "settings.updated", entityType: "Setting",
      description: `Platform Owner changed settings: ${keys.join(", ")}`,
      previousValue: Object.fromEntries(before.map((b) => [b.key, b.value])), newValue: values,
    });
    return NextResponse.json({ ok: true });
  });
}
