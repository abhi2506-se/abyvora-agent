import { pageGuard } from "@/lib/admin/guard";
import { listPayments } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { formatINR } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const ST = ["CREATED", "PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listPayments({ q: first(sp.q), status: oneOf(first(sp.status), ST), page });
  return (
    <>
      <PageHeader title="Transactions" description="Every payment attempt. State is driven by verified Razorpay webhooks, never by the browser." />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/revenue/transactions" fields={[{ name: "q", type: "search", placeholder: "Payment id, order id, receipt, client…" }, { name: "status", type: "select", label: "Any status", options: ST.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) }]} />
        <DataTable rowKey={(p) => p.id} rows={rows} empty={<EmptyBlock icon="card" title="No transactions" />}
          columns={[
            { key: "d", header: "Date", render: (p) => (p.paidAt ?? p.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) },
            { key: "id", header: "Payment", render: (p) => <span className="font-mono text-[11.5px]">{p.providerPaymentId ?? "—"}</span> },
            { key: "o", header: "Organization / client", render: (p) => p.organization?.name ?? p.client.name }, { key: "pr", header: "Project", render: (p) => p.project.name },
            { key: "a", header: "Amount", render: (p) => <b>{formatINR(Number(p.amount))}</b> }, { key: "m", header: "Method", render: (p) => p.paymentMethod ?? "—" },
            { key: "s", header: "Status", render: (p) => <><StatusPill value={p.status} />{p.failureReason && <span className="block text-[11px]" style={{ color: "var(--danger)" }}>{p.failureReason}</span>}</> },
          ]} />
        <Pagination base="/admin/revenue/transactions" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
