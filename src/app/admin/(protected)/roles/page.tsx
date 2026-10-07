import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { ROLE_INFO } from "@/lib/admin/roles";
import { PageHeader, Panel } from "@/components/admin/ui";
import Link from "next/link";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await pageGuard();
  const counts = await prisma.user.groupBy({ by: ["role"], _count: true });
  const c = new Map(counts.map((x) => [x.role, x._count]));
  const scopes = ["Platform", "ABYVORA internal", "Organization"] as const;
  return (
    <>
      <PageHeader title="Roles & Permissions" description="What each role can do. Roles are enforced server-side on every request; change a user's role from their profile." />
      {scopes.map((scope) => (
        <section key={scope} className="mb-6">
          <h2 className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{scope}</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {(Object.keys(ROLE_INFO) as Role[]).filter((r) => ROLE_INFO[r].scope === scope).map((r) => (
              <Panel key={r}>
                <div className="flex justify-between items-start"><h3 className="font-bold text-[15px]">{ROLE_INFO[r].label}</h3><Link href={`/admin/users?role=${r}`} className="adm-link-text">{c.get(r) ?? 0} users</Link></div>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>{ROLE_INFO[r].summary}</p>
                <ul className="list-disc pl-5 mt-2 text-[12.5px] space-y-0.5">{ROLE_INFO[r].can.map((x) => <li key={x}>{x}</li>)}</ul>
              </Panel>))}
          </div>
        </section>))}
    </>
  );
}
