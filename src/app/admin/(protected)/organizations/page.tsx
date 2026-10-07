import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listOrganizations } from "@/lib/admin/lists";
import { first, oneOf, parsePage, sortDir, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { NewOrganizationButton } from "@/components/admin/forms";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const STATUSES = ["PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "ACTIVE", "GRACE_PERIOD", "SUSPENDED", "TERMINATED", "REJECTED"] as const;

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const [{ total, rows }, plans] = await Promise.all([
    listOrganizations({ q: first(sp.q), status: oneOf(first(sp.status), STATUSES), planSlug: first(sp.plan), sort: oneOf(first(sp.sort), ["name", "createdAt"] as const), dir: sortDir(first(sp.dir)), page }),
    prisma.subscriptionPlan.findMany({ select: { slug: true, name: true }, orderBy: { priceMonthly: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="All Organizations" description="Every customer organization on the platform." actions={<NewOrganizationButton />} />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/organizations" fields={[
          { name: "q", type: "search", placeholder: "Search name, slug, email, industry…" },
          { name: "status", type: "select", label: "All statuses", options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) },
          { name: "plan", type: "select", label: "All plans", options: plans.map((p) => ({ value: p.slug, label: p.name })) },
          { name: "sort", type: "select", label: "Sort: newest", options: [{ value: "name", label: "Name" }, { value: "createdAt", label: "Created" }] },
        ]} />
        <DataTable rowKey={(r) => r.id} rows={rows} empty={<EmptyBlock icon="building" title="No organizations match" hint="Try clearing filters, or create the first organization." />}
          columns={[
            { key: "n", header: "Organization", render: (r) => <Link href={`/admin/organizations/${r.id}`} className="font-semibold hover:underline">{r.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{r.contactEmail ?? r.slug}</span></Link> },
            { key: "s", header: "Status", render: (r) => <StatusPill value={r.status} /> },
            { key: "p", header: "Plan", render: (r) => r.plan?.name ?? "—" },
            { key: "sub", header: "Subscription", render: (r) => r.subscription ? <StatusPill value={r.subscription.status} /> : "—" },
            { key: "u", header: "Users", render: (r) => formatNumber(r._count.users) },
            { key: "pr", header: "Projects", render: (r) => formatNumber(r._count.projects) },
            { key: "c", header: "Created", render: (r) => r.createdAt.toLocaleDateString("en-IN") },
          ]} />
        <Pagination base="/admin/organizations" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
