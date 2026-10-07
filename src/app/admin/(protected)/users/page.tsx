import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/lists";
import { first, oneOf, parsePage, type SP } from "@/lib/admin/paging";
import { DataTable, EmptyBlock, FilterBar, PageHeader, Pagination, Panel, StatusPill } from "@/components/admin/ui";
import { NewUserButton } from "@/components/admin/forms";
import { relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
const ROLES = ["PLATFORM_OWNER", "ADMIN", "AGENT", "CLIENT", "IT_SUPPORT", "ORG_OWNER", "ORG_ADMIN", "HIGHER_MANAGER", "MID_MANAGER", "LOWER_MANAGER", "HR", "EMPLOYEE"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard();
  const sp = await searchParams;
  const page = parsePage(first(sp.page));
  const { total, rows } = await listUsers({ q: first(sp.q), role: oneOf(first(sp.role), ROLES), status: oneOf(first(sp.status), ["ACTIVE", "DISABLED", "INVITED"] as const), organizationId: first(sp.org), page, sort: "createdAt" });
  return (
    <>
      <PageHeader title="All Users" description="Every account across the platform." actions={<NewUserButton />} />
      <Panel bodyClass="p-0">
        <FilterBar sp={sp} reset="/admin/users" fields={[
          { name: "q", type: "search", placeholder: "Search name or email…" },
          { name: "role", type: "select", label: "All roles", options: ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ") })) },
          { name: "status", type: "select", label: "Any status", options: ["ACTIVE", "DISABLED", "INVITED"].map((s) => ({ value: s, label: s })) },
        ]} />
        <DataTable rowKey={(u) => u.id} rows={rows} empty={<EmptyBlock icon="users" title="No users match" />}
          columns={[
            { key: "n", header: "User", render: (u) => <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{u.email}</span></Link> },
            { key: "r", header: "Role", render: (u) => u.role.replace(/_/g, " ") },
            { key: "o", header: "Organization", render: (u) => u.organization ? <Link href={`/admin/organizations/${u.organization.id}`} className="hover:underline">{u.organization.name}</Link> : "ABYVORA" },
            { key: "d", header: "Department", render: (u) => u.department?.name ?? "—" },
            { key: "s", header: "Status", render: (u) => <StatusPill value={u.status} /> },
            { key: "m", header: "MFA", render: (u) => (u.mfaEnabled ? "On" : "Off") },
            { key: "l", header: "Last login", render: (u) => (u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never") },
          ]} />
        <Pagination base="/admin/users" sp={sp} page={page} total={total} />
      </Panel>
    </>
  );
}
