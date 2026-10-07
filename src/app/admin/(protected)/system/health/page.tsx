import { pageGuard } from "@/lib/admin/guard";
import { getHealthMetrics, runHealthChecks, type ComponentStatus } from "@/lib/admin/health";
import { getUptime } from "@/lib/admin/dashboard";
import { resolveRange } from "@/lib/admin/range";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { RunCheckButton } from "@/components/admin/health-runner";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const TONE: Record<ComponentStatus, "success" | "warning" | "danger" | "neutral"> = { operational: "success", degraded: "warning", down: "danger", not_configured: "neutral" };
const LABEL: Record<ComponentStatus, string> = { operational: "Operational", degraded: "Degraded", down: "Down", not_configured: "Monitoring not configured" };

export default async function SystemHealthPage() {
  await pageGuard();
  const [components, m, uptime] = await Promise.all([runHealthChecks(), getHealthMetrics(), getUptime(resolveRange({ range: "30d" }))]);
  return (
    <>
      <PageHeader title="System Health" description="Only signals the platform can genuinely measure are shown; everything else says so." actions={<RunCheckButton />} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatTile label="Uptime (30 days)" value={uptime ? `${uptime.pct}%` : "Monitoring not configured"} hint={uptime ? `${uptime.samples} probes` : "Schedule GET /api/cron/health with CRON_SECRET to start recording"} />
        <StatTile label="DB latency (24h avg)" value={m.avgLatencyMs !== null ? `${m.avgLatencyMs} ms` : "—"} hint={m.probes24h ? `${m.probes24h} probes` : "No probes recorded"} />
        <StatTile label="Error rate (24h)" value={m.errorRatePct !== null ? `${m.errorRatePct}%` : "—"} hint={`${m.auditFailed24h} failed of ${m.auditEvents24h} audited actions`} />
        <StatTile label="Last probe" value={m.lastProbeAt ? relativeTime(m.lastProbeAt) : "Never"} />
      </div>
      <Panel title="Components" bodyClass="p-0">
        <ul>{components.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div><div className="font-semibold text-[13.5px]">{c.name}{c.latencyMs !== undefined && <span className="ml-2 text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{c.latencyMs} ms</span>}</div><div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.detail}</div></div>
            <Badge tone={TONE[c.status]} dot>{LABEL[c.status]}</Badge>
          </li>))}</ul>
      </Panel>
      <p className="text-[12px] mt-3" style={{ color: "var(--text-muted)" }}>Error rate is derived from failed vs. total audited actions — it is not an HTTP 5xx rate. Response-time and 5xx monitoring require an external APM, which isn’t configured.</p>
    </>
  );
}
