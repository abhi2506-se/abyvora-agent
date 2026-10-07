import Link from "next/link";
import { listAuditLogs } from "@/lib/admin/lists";
import { first, oneOf, type SP } from "@/lib/admin/paging";
import { parseIsoDate, addDays } from "@/lib/admin/range";
import { prisma } from "@/lib/prisma";
import { describeAction } from "@/lib/admin/activity-labels";
import { DataTable, EmptyBlock, FilterBar, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";

/** Shared audit-log table. `onlyOrganizations` limits to tenant-scoped rows; `organizationId` pins one tenant. */
export async function AuditTable({ base, sp, page, filters = {} }: { base: string; sp: SP; page: number; filters?: { organizationId?: string; onlyOrganizations?: boolean; actionPrefix?: string } }) {
  const from = parseIsoDate(first(sp.from));
  const toD = parseIsoDate(first(sp.to));
  const { total, rows } = await listAuditLogs({
    q: first(sp.q), status: oneOf(first(sp.status), ["SUCCESS", "FAILED"] as const), entityType: first(sp.entity),
    organizationId: filters.organizationId, onlyOrganizations: filters.onlyOrganizations, actionPrefix: first(sp.prefix) ?? filters.actionPrefix, from: from ?? undefined, to: toD ? addDays(toD, 1) : undefined, page,
  });
  const entities = await prisma.auditLog.groupBy({ by: ["entityType"], _count: true, orderBy: { _count: { entityType: "desc" } }, take: 30 });
  return (
    <Panel bodyClass="p-0">
      <FilterBar sp={sp} reset={base} fields={[
        { name: "q", type: "search", placeholder: "Search action, actor, description, entity id…" },
        { name: "status", type: "select", label: "Any outcome", options: [{ value: "SUCCESS", label: "Success" }, { value: "FAILED", label: "Failed / blocked" }] },
        { name: "entity", type: "select", label: "All entities", options: entities.map((e) => ({ value: e.entityType, label: e.entityType })) },
        { name: "prefix", type: "select", label: "All categories", options: ["organization.", "user.", "subscription.", "plan.", "payment.", "refund.", "support_ticket.", "security.", "mfa.", "export.", "settings.", "system."].map((p) => ({ value: p, label: p.replace(".", "").replace("_", " ") })) },
      ]} />
      <form method="get" className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        {Object.entries(sp).filter(([k]) => !["from", "to", "page"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={first(v) ?? ""} />)}
        From <input type="date" name="from" defaultValue={first(sp.from) ?? ""} className="field-input" style={{ padding: "5px 8px", width: "auto" }} />
        To <input type="date" name="to" defaultValue={first(sp.to) ?? ""} className="field-input" style={{ padding: "5px 8px", width: "auto" }} />
        <button className="adm-link-text" type="submit">Set dates</button>
      </form>
      <DataTable rowKey={(r) => r.id} rows={rows} empty={<EmptyBlock icon="file" title="No audit events match" hint="Adjust filters or the date range." />}
        columns={[
          { key: "t", header: "Time", render: (r) => <span className="whitespace-nowrap">{r.createdAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span> },
          { key: "a", header: "Event", render: (r) => <><span className="font-semibold">{describeAction(r.action).title}</span><span className="block text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{r.action}</span></> },
          { key: "act", header: "Actor", render: (r) => <>{r.actorName ?? "System"}<span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{r.actorRole}</span></> },
          { key: "e", header: "Entity", render: (r) => <>{r.entityType}{r.entityId && <span className="block text-[11px] font-mono truncate max-w-[120px]" style={{ color: "var(--text-muted)" }}>{r.entityId}</span>}</> },
          { key: "o", header: "Organization", render: (r) => r.organization?.name ?? <Badge>Platform</Badge> },
          { key: "d", header: "Detail", render: (r) => <span className="block max-w-[300px] truncate" style={{ color: "var(--text-secondary)" }} title={r.errorDetail ?? r.description ?? ""}>{r.errorDetail ?? r.description ?? "—"}</span> },
          { key: "s", header: "Outcome", render: (r) => <StatusPill value={r.status} /> },
        ]} />
      <Pagination base={base} sp={sp} page={page} total={total} />
      <div className="px-5 pb-3 pt-1 text-[12.5px]"><Link href={`/api/admin/reports/export?type=custom&dataset=audit&range=this_year`} className="adm-link-text">Export audit log (CSV, this year) — audited</Link></div>
    </Panel>
  );
}
