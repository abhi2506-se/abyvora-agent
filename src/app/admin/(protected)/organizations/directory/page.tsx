import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listOrganizations } from "@/lib/admin/lists";
import { first, parsePage, type SP } from "@/lib/admin/paging";
import { EmptyBlock, FilterBar, PageHeader, Pagination, StatusPill } from "@/components/admin/ui";
import { initials } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function OrgDirectoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listOrganizations({ q: first(sp.q), status: ["ACTIVE", "GRACE_PERIOD", "APPROVED"], sort: "name", dir: "asc", page });
  return (
    <>
      <PageHeader title="Organization Directory" description="Live organizations at a glance." />
      <div className="adm-card overflow-hidden">
        <FilterBar sp={sp} reset="/admin/organizations/directory" fields={[{ name: "q", type: "search", placeholder: "Find an organization…" }]} />
        {rows.length === 0 ? <EmptyBlock icon="book" title="No live organizations" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
            {rows.map((o) => (
              <Link key={o.id} href={`/admin/organizations/${o.id}`} className="rounded-xl p-4 flex gap-3 hover:opacity-90" style={{ border: "1px solid var(--border)" }}>
                <span className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{initials(o.name)}</span>
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{o.name}</span>
                  <span className="block text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>{[o.industry, o.plan?.name].filter(Boolean).join(" · ") || o.slug}</span>
                  <span className="mt-1.5 inline-flex items-center gap-2 text-[11.5px]"><StatusPill value={o.status} /><span style={{ color: "var(--text-muted)" }}>{o._count.users} users</span></span>
                </span>
              </Link>
            ))}
          </div>
        )}
        <Pagination base="/admin/organizations/directory" sp={sp} page={page} total={total} />
      </div>
    </>
  );
}
