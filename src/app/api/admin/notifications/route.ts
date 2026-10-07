import { NextRequest, NextResponse } from "next/server";
import { apiGuard } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { getNotificationFeed } from "@/lib/admin/notifications";
import { notificationPatchSchema } from "@/lib/admin/schemas";

export async function GET() {
  return apiGuard(async (session) => NextResponse.json(await getNotificationFeed(session.user.id)));
}

/** Marks the caller's OWN stored notifications read. userId always comes from the session. */
export async function PATCH(req: NextRequest) {
  return apiGuard(async (session) => {
    const body = notificationPatchSchema.parse(await req.json());
    const where = "all" in body
      ? { userId: session.user.id, read: false }
      : { userId: session.user.id, id: { in: body.ids } };
    const res = await prisma.notification.updateMany({ where, data: { read: true, readAt: new Date() } });
    return NextResponse.json({ updated: res.count });
  });
}
