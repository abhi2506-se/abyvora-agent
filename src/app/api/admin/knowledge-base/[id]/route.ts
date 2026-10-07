import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiGuard, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const patch = z.object({ published: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const { published } = patch.parse(await req.json());
    const a = await prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!a) return notFound("Article not found");
    await prisma.knowledgeArticle.update({ where: { id }, data: { published } });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: published ? "knowledge_base.published" : "knowledge_base.unpublished",
      entityType: "KnowledgeArticle", entityId: id, description: `${published ? "Published" : "Unpublished"} "${a.title}"`,
    });
    return NextResponse.json({ ok: true });
  });
}
