import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listInvoices } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { NewInvoiceButton } from "@/components/admin/forms";
import { formatINR } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const ST = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listInvoices({ q: first(sp.q), status: oneOf(first(sp.status), ST), page });
  return (
    <>
      <PageHeader title="Invoices" actions={<NewInvoiceButton />} />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/revenue/invoices" fields={[{ name: "q", type: "search", placeholder: "Invoice number, billing name or email…" }, { name: "status", type: "select", label: "Any status", options: ST.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) }]} />
        <DataTable rowKey={(i) => i.id} rows={rows} empty={<EmptyBlock icon="file" title="No invoices" hint="Generate one with “+ Generate invoice”." />}
          columns={[
            { key: "n", header: "Invoice", render: (i) => <Link href={`/invoice/${i.id}`} className="adm-link-text">{i.invoiceNumber}</Link> }, { key: "b", header: "Billed to", render: (i) => i.billingName },
            { key: "o", header: "Organization", render: (i) => i.organization?.name ?? "—" }, { key: "p", header: "Project", render: (i) => i.project.name },
            { key: "t", header: "Total", render: (i) => <b>{formatINR(Number(i.total))}</b> }, { key: "pd", header: "Paid", render: (i) => formatINR(Number(i.paidAmount)) },
            { key: "s", header: "Status", render: (i) => <StatusPill value={i.paymentStatus} /> }, { key: "d", header: "Issued", render: (i) => i.issuedAt.toLocaleDateString("en-IN") },
          ]} />
        <Pagination base="/admin/revenue/invoices" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
