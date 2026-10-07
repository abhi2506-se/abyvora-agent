import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { describeAction } from "@/lib/admin/activity-labels";
import { msAgo } from "@/lib/admin/range";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function SecurityCompliancePage() {
  await pageGuard();
  const d7 = msAgo(7 * 86400000), d30 = msAgo(30 * 86400000);
  const [staff, staffMfa, failed7, invalidHook, disabled, stale, recent] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["PLATFORM_OWNER", "ADMIN", "IT_SUPPORT"] }, status: "ACTIVE" } }),
    prisma.user.count({ where: { role: { in: ["PLATFORM_OWNER", "ADMIN", "IT_SUPPORT"] }, status: "ACTIVE", mfaEnabled: true } }),
    prisma.auditLog.count({ where: { status: "FAILED", createdAt: { gte: d7 } } }),
    prisma.auditLog.count({ where: { action: { startsWith: "webhook." }, status: "FAILED", createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { status: "DISABLED" } }),
    prisma.user.count({ where: { status: "ACTIVE", role: { not: "PLATFORM_OWNER" }, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: d30 } }] } }),
    prisma.auditLog.findMany({ where: { OR: [{ status: "FAILED" }, { action: { startsWith: "mfa." } }, { action: { startsWith: "security." } }] }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, status: true, actorName: true, description: true, errorDetail: true, createdAt: true } }),
  ]);
  return (
    <>
      <PageHeader title="Security & Compliance" description="Access-control posture and recent security-relevant events." />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <StatTile label="Staff MFA coverage" value={staff ? `${Math.round((staffMfa / staff) * 100)}%` : "—"} hint={`${staffMfa} of ${staff} staff accounts`} />
        <StatTile label="Failed/blocked (7d)" value={failed7} href="/admin/system/audit-logs?status=FAILED" />
        <StatTile label="Webhook rejections (7d)" value={invalidHook} href="/admin/system/audit-logs?prefix=webhook." />
        <StatTile label="Disabled accounts" value={disabled} href="/admin/users?status=DISABLED" />
        <StatTile label="Inactive 30d+" value={stale} hint="Active accounts, no recent sign-in" />
      </div>
      <Panel title="Recent security events" bodyClass="p-0 pb-2"><div className="pt-2">
        <DataTable rowKey={(e) => e.id} rows={recent} empty={<EmptyBlock icon="shield" title="No security events recorded" />}
          columns={[{ key: "a", header: "Event", render: (e) => <><b>{describeAction(e.action).title}</b><span className="block text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{e.action}</span></> }, { key: "w", header: "Actor", render: (e) => e.actorName ?? "System" },
            { key: "d", header: "Detail", render: (e) => <span className="block max-w-[320px] truncate" style={{ color: "var(--text-secondary)" }}>{e.errorDetail ?? e.description ?? "—"}</span> }, { key: "t", header: "When", render: (e) => relativeTime(e.createdAt) }]} /></div></Panel>
    </>
  );
}
