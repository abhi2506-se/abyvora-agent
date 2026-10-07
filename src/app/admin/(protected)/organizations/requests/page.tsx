import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listOrganizations } from "@/lib/admin/lists";
import { first, parsePage, type SP } from "@/lib/admin/paging";
import { EmptyBlock, PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { OrgDecisionButtons } from "@/components/admin/org-controls";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function OrgRequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listOrganizations({ status: "PENDING_REVIEW", sort: "createdAt", dir: "asc", page });
  return (
    <>
      <PageHeader title="Organization Requests" description="New registrations awaiting your review, oldest first." />
      <Panel bodyClass="p-0">
        {rows.length === 0 ? <EmptyBlock icon="inbox" title="No pending requests" hint="New organization registrations will land here for review." /> : (
          <ul>
            {rows.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <Link href={`/admin/organizations/${o.id}`} className="font-semibold text-[14px] hover:underline">{o.name}</Link>
                  <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{[o.industry, o.contactEmail, `requested ${relativeTime(o.createdAt)}`].filter(Boolean).join(" · ")}</div>
                </div>
                <OrgDecisionButtons orgId={o.id} orgName={o.name} />
              </li>
            ))}
          </ul>
        )}
        <Pagination base="/admin/organizations/requests" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
