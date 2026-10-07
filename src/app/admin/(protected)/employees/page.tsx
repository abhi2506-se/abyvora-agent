import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/lists";
import { first, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { AddAgentButton, NewUserButton } from "@/components/admin/forms";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function EmployeeDirectoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  // ABYVORA employees = internal accounts (no organization), excluding the Platform Owner and customer-portal clients.
  const { total, rows } = await listUsers({ q: first(sp.q), internalOnly: true, page, sort: "name", dir: "asc" });
  const staff = rows.filter((r) => r.role !== "CLIENT" && r.role !== "PLATFORM_OWNER");
  return (
    <>
      <PageHeader title="Employee Directory" description="ABYVORA's own staff (accounts not tied to a customer organization)." actions={<><AddAgentButton /><NewUserButton /></>} />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/employees" fields={[{ name: "q", type: "search", placeholder: "Search staff…" }]} />
        <DataTable rowKey={(u) => u.id} rows={staff} empty={<EmptyBlock icon="users" title="No ABYVORA staff found" />}
          columns={[
            { key: "n", header: "Employee", render: (u) => <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{u.email}</span></Link> },
            { key: "r", header: "Role", render: (u) => u.role.replace(/_/g, " ") }, { key: "d", header: "Department", render: (u) => u.department?.name ?? "—" },
            { key: "t", header: "Team", render: (u) => u.team?.name ?? "—" }, { key: "m", header: "Manager", render: (u) => u.manager?.name ?? "—" },
            { key: "s", header: "Status", render: (u) => <StatusPill value={u.status} /> }, { key: "l", header: "Last login", render: (u) => (u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never") },
          ]} />
        <Pagination base="/admin/employees" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
