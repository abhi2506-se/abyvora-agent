import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel, StatTile, DataTable, EmptyBlock } from "@/components/admin/ui";
import { getOrganizationsByPlan } from "@/lib/admin/dashboard";
import { densify, listBuckets, resolveRange } from "@/lib/admin/range";
import { DonutChart } from "@/components/admin/charts";
import { formatNumber } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function OrgAnalyticsPage() {
  await pageGuard();
  const range = resolveRange({ range: "this_year" });
  const [byStatus, byIndustry, plans, signups, total] = await Promise.all([
    prisma.organization.groupBy({ by: ["status"], _count: true }),
    prisma.organization.groupBy({ by: ["industry"], _count: true, orderBy: { _count: { industry: "desc" } }, take: 8 }),
    getOrganizationsByPlan("all"),
    prisma.$queryRaw<{ bucket: Date; total: bigint }[]>`SELECT date_trunc('month', "createdAt") AS bucket, COUNT(*) AS total FROM "Organization" WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to} GROUP BY 1`,
    prisma.organization.count(),
  ]);
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x._count]));
  const monthly = densify(range, "month", signups.map((r) => ({ bucket: r.bucket, value: Number(r.total) })));
  const max = Math.max(1, ...monthly.map((m) => m.value));
  void listBuckets;
  return (
    <>
      <PageHeader title="Organization Analytics" description="Distribution, lifecycle and sign-up trend (this year)." />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <StatTile label="Total" value={formatNumber(total)} />
        <StatTile label="Active" value={formatNumber(s.ACTIVE ?? 0)} href="/admin/organizations?status=ACTIVE" />
        <StatTile label="Pending review" value={formatNumber(s.PENDING_REVIEW ?? 0)} href="/admin/organizations/requests" />
        <StatTile label="Suspended / grace" value={formatNumber((s.SUSPENDED ?? 0) + (s.GRACE_PERIOD ?? 0))} href="/admin/organizations?status=SUSPENDED" />
        <StatTile label="Terminated / rejected" value={formatNumber((s.TERMINATED ?? 0) + (s.REJECTED ?? 0))} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="By plan">{plans.total === 0 ? <EmptyBlock icon="crown" title="No organizations yet" /> : <DonutChart total={plans.total} slices={plans.slices.map((x) => ({ name: x.name, count: x.count, pct: x.pct, href: x.slug ? `/admin/organizations?plan=${x.slug}` : "/admin/organizations" }))} />}</Panel>
        <Panel title="New organizations per month">
          <div className="flex items-end gap-2 h-44">
            {monthly.map((m) => (
              <div key={m.bucket} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${m.bucket}: ${m.value}`}>
                <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>{m.value || ""}</span>
                <div className="w-full rounded-t-md" style={{ height: `${(m.value / max) * 100}%`, minHeight: m.value ? 4 : 2, background: m.value ? "var(--brand)" : "var(--border)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(m.bucket).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Top industries" bodyClass="p-0 pb-2"><div className="pt-3">
          <DataTable rowKey={(r) => r.industry ?? "none"} rows={byIndustry} empty={<EmptyBlock title="No industry data" />}
            columns={[{ key: "i", header: "Industry", render: (r) => r.industry ?? "Not specified" }, { key: "c", header: "Organizations", render: (r) => r._count }]} /></div></Panel>
      </div>
    </>
  );
}
