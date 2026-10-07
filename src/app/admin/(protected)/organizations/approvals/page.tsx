import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { OrgDecisionButtons } from "@/components/admin/org-controls";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function OrgApprovalsPage() {
  await pageGuard();
  const [waiting, history] = await Promise.all([
    prisma.organization.findMany({ where: { status: { in: ["CHANGES_REQUESTED", "APPROVED"] } }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, status: true, updatedAt: true } }),
    prisma.organizationApproval.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, decision: true, reason: true, createdAt: true, organization: { select: { id: true, name: true } }, reviewer: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Organization Approvals" description="Organizations sent back for changes or approved but not yet activated (no plan), plus the full decision history." />
      <div className="space-y-5">
        <Panel title="Awaiting follow-up" bodyClass="p-0">
          {waiting.length === 0 ? <EmptyBlock icon="check" title="Nothing waiting" hint="Approved-without-plan and changes-requested organizations appear here." /> : (
            <ul>
              {waiting.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
                  <div><Link href={`/admin/organizations/${o.id}`} className="font-semibold hover:underline">{o.name}</Link> <StatusPill value={o.status} />
                    <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Updated {relativeTime(o.updatedAt)}</div></div>
                  {o.status === "CHANGES_REQUESTED" ? <OrgDecisionButtons orgId={o.id} orgName={o.name} /> : <Link href={`/admin/organizations/${o.id}?tab=subscription`} className="adm-link-text">Assign a plan to activate →</Link>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Decision history" bodyClass="p-0 pb-2"><div className="pt-2">
          <DataTable rowKey={(r) => r.id} rows={history} empty={<EmptyBlock icon="book" title="No decisions recorded yet" />}
            columns={[
              { key: "o", header: "Organization", render: (r) => <Link href={`/admin/organizations/${r.organization.id}`} className="font-semibold hover:underline">{r.organization.name}</Link> },
              { key: "d", header: "Decision", render: (r) => <StatusPill value={r.decision} /> },
              { key: "r", header: "Reviewer", render: (r) => r.reviewer.name },
              { key: "why", header: "Reason", render: (r) => <span className="block max-w-[320px] truncate" style={{ color: "var(--text-secondary)" }}>{r.reason ?? "—"}</span> },
              { key: "t", header: "When", render: (r) => relativeTime(r.createdAt) },
            ]} /></div>
        </Panel>
      </div>
    </>
  );
}
