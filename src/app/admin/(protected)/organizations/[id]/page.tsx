import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { first, type SP } from "@/lib/admin/paging";
import { PageHeader, StatusPill } from "@/components/admin/ui";
import { ORG_TABS, OrgTabContent, type OrgTab } from "@/components/admin/org-360";

export const dynamic = "force-dynamic";

/** Organization 360 — platform-wide view of one tenant. The id comes from the URL but is only used after the Platform Owner guard + an existence check. */
export default async function Organization360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await pageGuard();
  const { id } = await params;
  const sp = await searchParams;
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true, status: true, ownerId: true, plan: { select: { name: true, features: true } } } });
  if (!org) notFound();
  const t = first(sp.tab);
  const tab: OrgTab = (ORG_TABS.find(([k]) => k === t)?.[0] ?? "overview") as OrgTab;
  const maxUsers = (org.plan?.features as Record<string, unknown> | null)?.maxUsers;

  return (
    <>
      <PageHeader title={org.name} description="Organization 360" actions={<StatusPill value={org.status} />} />
      <nav className="flex gap-1 overflow-x-auto pb-2 mb-4" aria-label="Organization sections" style={{ borderBottom: "1px solid var(--border)" }}>
        {ORG_TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/organizations/${id}?tab=${k}`} aria-current={k === tab ? "page" : undefined}
            className="px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap" style={k === tab ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-secondary)" }}>{label}</Link>
        ))}
      </nav>
      <OrgTabContent tab={tab} sp={sp} org={{ id: org.id, name: org.name, status: org.status, ownerId: org.ownerId, planName: org.plan?.name ?? null, maxUsers: typeof maxUsers === "number" ? maxUsers : null }} />
    </>
  );
}
