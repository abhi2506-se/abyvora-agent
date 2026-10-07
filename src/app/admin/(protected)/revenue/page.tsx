import Link from "next/link";
import { Suspense } from "react";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { first, type SP } from "@/lib/admin/paging";
import { rangeLabel, resolveRange } from "@/lib/admin/range";
import { revenueTotals } from "@/lib/admin/dashboard";
import { PageHeader, StatTile } from "@/components/admin/ui";
import { RangePicker } from "@/components/admin/range-picker";
import { Lazy, RevenuePanel, ServicesPanel, type DashParams } from "@/components/admin/dashboard-sections";
import { NewInvoiceButton } from "@/components/admin/forms";
import { msAgo } from "@/lib/admin/range";
import { formatINR } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function PaymentDashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const range = resolveRange({ range: first(sp.range), from: first(sp.from), to: first(sp.to) });
  const p: DashParams = { range, group: first(sp.group) };
  const [t, mrr, pendingRefunds, stuck] = await Promise.all([
    revenueTotals(range),
    prisma.organizationSubscription.findMany({ where: { status: "ACTIVE" }, select: { plan: { select: { priceMonthly: true } } } }),
    prisma.refund.aggregate({ where: { status: { in: ["REQUESTED", "PROCESSING", "INITIATED"] } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: { in: ["CREATED", "PENDING", "AUTHORIZED"] }, createdAt: { lt: msAgo(3600_000) } } }),
  ]);
  const mrrTotal = mrr.reduce((s, x) => s + Number(x.plan.priceMonthly), 0);
  return (
    <>
      <PageHeader title="Payment Dashboard" description="Net revenue = settled payments − processed refunds. Failed and cancelled payments are never counted." actions={<><Suspense><RangePicker label={rangeLabel(range)} /></Suspense><NewInvoiceButton /></>} />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <StatTile label="Net revenue" value={formatINR(t.net)} hint={`${t.paymentCount} payments`} />
        <StatTile label="Gross" value={formatINR(t.gross)} />
        <StatTile label="Refunded" value={formatINR(t.refunds)} hint={`${t.refundCount} refunds`} href="/admin/revenue/refunds" />
        <StatTile label="Failed / cancelled" value={t.failedCount} hint={formatINR(t.failedAmount)} href="/admin/revenue/transactions?status=FAILED" />
        <StatTile label="Recurring (active subs)" value={formatINR(mrrTotal)} hint="Sum of active plan monthly prices" href="/admin/revenue/subscriptions" />
      </div>
      {((pendingRefunds._count._all ?? 0) > 0 || stuck > 0) && (
        <div className="adm-card p-4 mb-5 text-[13px] flex flex-wrap gap-x-6 gap-y-1">
          {(pendingRefunds._count._all ?? 0) > 0 && <Link href="/admin/revenue/refunds" className="adm-link-text">{pendingRefunds._count._all} refund(s) in flight ({formatINR(Number(pendingRefunds._sum.amount ?? 0))})</Link>}
          {stuck > 0 && <Link href="/admin/revenue/gateways" className="adm-link-text">{stuck} payment(s) un-settled for over an hour — check webhooks</Link>}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7"><Lazy><RevenuePanel p={p} /></Lazy></div>
        <div className="xl:col-span-5"><Lazy h={200}><ServicesPanel p={p} /></Lazy></div>
      </div>
    </>
  );
}
