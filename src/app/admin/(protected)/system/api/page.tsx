import { pageGuard } from "@/lib/admin/guard";
import { PageHeader, Panel } from "@/components/admin/ui";
import { IntegrationList } from "@/components/admin/integration-list";

export const dynamic = "force-dynamic";
const ENDPOINTS = [["/api/webhooks/razorpay", "Razorpay payment & refund events (HMAC-verified)"], ["/api/webhooks/email", "Inbound email events"], ["/api/cron/health", "Scheduled health probe — Bearer CRON_SECRET"], ["/api/admin/*", "Platform Owner API — session + MFA required"]];

export default async function ApiPage() {
  await pageGuard();
  return (
    <>
      <PageHeader title="API / Integrations" description="Inbound endpoints and outbound integration configuration." />
      <div className="space-y-5">
        <Panel title="Endpoints" bodyClass="p-0"><ul>{ENDPOINTS.map(([p, d]) => (<li key={p} className="flex flex-wrap justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}><code className="text-[12.5px]">{p}</code><span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>{d}</span></li>))}</ul></Panel>
        <IntegrationList />
      </div>
    </>
  );
}
