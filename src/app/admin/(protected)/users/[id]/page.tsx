import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { ROLE_INFO } from "@/lib/admin/roles";
import { describeAction } from "@/lib/admin/activity-labels";
import { EmptyBlock, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { UserControls } from "@/components/admin/user-controls";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageGuard();
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, status: true, mfaEnabled: true, lastLoginAt: true, createdAt: true, emailVerified: true, organizationId: true,
      organization: { select: { id: true, name: true } }, department: { select: { name: true } }, team: { select: { name: true } }, manager: { select: { id: true, name: true } }, _count: { select: { directReports: true } } },
  });
  if (!u) notFound();
  const events = await prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { entityType: "User", entityId: id }] }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, action: true, status: true, description: true, createdAt: true } });
  const info = ROLE_INFO[u.role];
  const rows: [string, React.ReactNode][] = [
    ["Email", <>{u.email}{u.emailVerified ? "" : " (unverified)"}</>], ["Phone", u.phone ?? "—"], ["Role", info.label],
    ["Organization", u.organization ? <Link className="adm-link-text" href={`/admin/organizations/${u.organization.id}`}>{u.organization.name}</Link> : "ABYVORA (internal)"],
    ["Department", u.department?.name ?? "—"], ["Team", u.team?.name ?? "—"], ["Manager", u.manager ? u.manager.name : "—"], ["Direct reports", u._count.directReports],
    ["MFA", u.mfaEnabled ? "Enabled" : "Not enabled"], ["Last login", u.lastLoginAt ? `${u.lastLoginAt.toLocaleString("en-IN")} (${relativeTime(u.lastLoginAt)})` : "Never"], ["Created", u.createdAt.toLocaleDateString("en-IN")],
  ];
  return (
    <>
      <PageHeader title={u.name} description={u.email} actions={<StatusPill value={u.status} />} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel title="Profile" className="xl:col-span-2">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
            {rows.map(([k, v]) => (<div key={k}><dt className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            {u.role === "PLATFORM_OWNER" || u.id === session.user.id
              ? <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>{u.id === session.user.id ? "You can’t change your own role or status here." : "Platform Owner accounts can’t be modified from the console."}</p>
              : <UserControls userId={u.id} role={u.role} status={u.status} organizationId={u.organizationId} />}
          </div>
        </Panel>
        <Panel title={`Permissions — ${info.label}`}>
          <p className="text-[12.5px] mb-2" style={{ color: "var(--text-secondary)" }}>{info.summary}</p>
          <ul className="list-disc pl-5 text-[13px] space-y-1">{info.can.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--text-muted)" }}>Permissions are role-based; there are no per-user overrides.</p>
        </Panel>
        <Panel title="Security events" className="xl:col-span-3">
          {events.length === 0 ? <EmptyBlock icon="shield" title="No recorded events for this user" /> : (
            <ul className="space-y-2 text-[13px]">{events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3"><span><b>{describeAction(e.action).title}</b> <span style={{ color: "var(--text-secondary)" }}>{e.description}</span> {e.status === "FAILED" && <StatusPill value="FAILED" />}</span><span style={{ color: "var(--text-muted)" }}>{relativeTime(e.createdAt)}</span></li>))}</ul>)}
        </Panel>
      </div>
    </>
  );
}
