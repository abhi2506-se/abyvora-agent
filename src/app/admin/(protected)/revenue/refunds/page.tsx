import { pageGuard } from "@/lib/admin/guard";
import { listRefunds } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { RefundAdminActions } from "@/app/(dashboard)/dashboard/refunds/refund-admin-actions";
import { formatINR, relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const ST = ["REQUESTED", "PROCESSING", "INITIATED", "PROCESSED", "REJECTED", "FAILED", "CANCELLED"] as const;

export default async function RefundsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listRefunds({ q: first(sp.q), status: oneOf(first(sp.status), ST), page });
  return (
    <>
      <PageHeader title="Refunds" description="Approving initiates the refund with Razorpay; it only counts against revenue once the gateway confirms it as processed." />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/revenue/refunds" fields={[{ name: "q", type: "search", placeholder: "Refund id or client…" }, { name: "status", type: "select", label: "Any status", options: ST.map((s) => ({ value: s, label: s })) }]} />
        <DataTable rowKey={(r) => r.id} rows={rows} empty={<EmptyBlock icon="undo" title="No refunds" />}
          columns={[
            { key: "d", header: "Requested", render: (r) => relativeTime(r.requestedAt) }, { key: "o", header: "Organization / client", render: (r) => r.organization?.name ?? r.client.name },
            { key: "p", header: "Project", render: (r) => r.project.name }, { key: "a", header: "Amount", render: (r) => <b>{formatINR(Number(r.amount))}</b> },
            { key: "w", header: "Reason", render: (r) => <span className="block max-w-[220px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</span> }, { key: "s", header: "Status", render: (r) => <StatusPill value={r.status} /> },
            { key: "x", header: "", render: (r) => <RefundAdminActions refundId={r.id} status={r.status} /> },
          ]} />
        <Pagination base="/admin/revenue/refunds" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
