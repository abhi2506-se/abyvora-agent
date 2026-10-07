import { NextRequest, NextResponse } from "next/server";
import { apiGuard, slugify } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { kbSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const d = kbSchema.parse(await req.json());
    let slug = slugify(d.title);
    if (await prisma.knowledgeArticle.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const article = await prisma.knowledgeArticle.create({ data: { ...d, slug, authorId: session.user.id } });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "knowledge_base.created", entityType: "KnowledgeArticle", entityId: article.id,
      description: `Created knowledge-base article "${article.title}"`,
    });
    return NextResponse.json({ article }, { status: 201 });
  });
}
