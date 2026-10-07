import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { getHealthMetrics } from "@/lib/admin/health";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { msAgo } from "@/lib/admin/range";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const has = (...k: string[]) => k.every((x) => !!process.env[x]);

export default async function GatewaysPage() {
  await pageGuard();
  const hourAgo = msAgo(3600_000);
  const [m, stuck, failed7, lastPayment] = await Promise.all([
    getHealthMetrics(),
    prisma.payment.count({ where: { status: { in: ["CREATED", "PENDING", "AUTHORIZED"] }, createdAt: { lt: hourAgo } } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: msAgo(7 * 86400000) } } }),
    prisma.payment.findFirst({ where: { provider: "razorpay" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const keys = has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"), hook = has("RAZORPAY_WEBHOOK_SECRET");
  return (
    <>
      <PageHeader title="Payment Gateways" description="Razorpay is the only gateway wired into the platform." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatTile label="Un-settled > 1h" value={stuck} hint="Created/pending/authorized — webhook may be missing" href="/admin/revenue/transactions?status=PENDING" />
        <StatTile label="Failed (7 days)" value={failed7} href="/admin/revenue/transactions?status=FAILED" />
        <StatTile label="Invalid webhook signatures (24h)" value={m.invalidWebhookSignatures24h} hint="Rejected server-side" href="/admin/system/audit-logs?q=webhook" />
        <StatTile label="Last payment created" value={lastPayment ? relativeTime(lastPayment.createdAt) : "—"} />
      </div>
      <Panel title="Razorpay">
        <ul className="text-[13.5px] space-y-3">
          <li className="flex justify-between"><span>API credentials (<code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code>)</span><Badge tone={keys ? "success" : "danger"}>{keys ? "Configured" : "Missing"}</Badge></li>
          <li className="flex justify-between"><span>Webhook signing secret (<code>RAZORPAY_WEBHOOK_SECRET</code>)</span><Badge tone={hook ? "success" : "danger"}>{hook ? "Configured" : "Missing"}</Badge></li>
          <li className="flex justify-between"><span>Webhook endpoint</span><code className="text-[12px]">/api/webhooks/razorpay</code></li>
          <li className="flex justify-between"><span>Last captured payment</span><b>{m.lastCapturedPaymentAt ? relativeTime(m.lastCapturedPaymentAt) : "None yet"}</b></li>
        </ul>
        <p className="text-[12px] mt-4" style={{ color: "var(--text-secondary)" }}>Payment and refund state changes only on a signature-verified webhook or a server-side API call — never from the browser. Configuration presence is shown here; Razorpay’s own availability is not probed. <Link href="/admin/system/health" className="adm-link-text">System health →</Link></p>
      </Panel>
    </>
  );
}
