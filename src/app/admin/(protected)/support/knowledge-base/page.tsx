import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { EmptyBlock, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { NewArticleButton, PublishToggle } from "@/components/admin/kb-controls";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  await pageGuard();
  const articles = await prisma.knowledgeArticle.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Knowledge Base" description="Support articles. Only published articles are intended for customers." actions={<NewArticleButton />} />
      <Panel bodyClass="p-0">
        {articles.length === 0 ? <EmptyBlock icon="book" title="No articles yet" hint="Write the first article with “+ New article”." /> : (
          <ul>{articles.map((a) => (
            <li key={a.id} className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-3"><div className="font-semibold">{a.title} <span className="ml-2 text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{a.category}</span></div>
                <div className="flex items-center gap-3"><StatusPill value={a.published ? "ACTIVE" : "DRAFT"} /><PublishToggle id={a.id} published={a.published} /></div></div>
              <p className="text-[12.5px] mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{a.body}</p>
            </li>))}</ul>)}
      </Panel>
    </>
  );
}
