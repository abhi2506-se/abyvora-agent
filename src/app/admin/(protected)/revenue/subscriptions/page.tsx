import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listSubscriptions } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { formatINR } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const ST = ["ACTIVE", "PAYMENT_DUE", "GRACE_PERIOD", "SUSPENDED", "TERMINATED"] as const;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listSubscriptions({ q: first(sp.q), status: oneOf(first(sp.status), ST), page });
  return (
    <>
      <PageHeader title="Subscriptions" description="Change plans, start grace periods, suspend or terminate from each organization’s Subscription tab." />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/revenue/subscriptions" fields={[{ name: "q", type: "search", placeholder: "Organization…" }, { name: "status", type: "select", label: "Any status", options: ST.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) }]} />
        <DataTable rowKey={(s) => s.id} rows={rows} empty={<EmptyBlock icon="crown" title="No subscriptions" hint="Assign a plan to an organization to start one." />}
          columns={[
            { key: "o", header: "Organization", render: (s) => <Link href={`/admin/organizations/${s.organization.id}?tab=subscription`} className="font-semibold hover:underline">{s.organization.name}</Link> },
            { key: "p", header: "Plan", render: (s) => `${s.plan.name} · ${formatINR(Number(s.plan.priceMonthly))}/mo` }, { key: "s", header: "Status", render: (s) => <StatusPill value={s.status} /> },
            { key: "e", header: "Period ends", render: (s) => s.currentPeriodEnd.toLocaleDateString("en-IN") },
            { key: "g", header: "Grace ends", render: (s) => (s.gracePeriodEndsAt ? s.gracePeriodEndsAt.toLocaleDateString("en-IN") : "—") }, { key: "c", header: "Cancels at end", render: (s) => (s.cancelAtPeriodEnd ? "Yes" : "No") },
          ]} />
        <Pagination base="/admin/revenue/subscriptions" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
