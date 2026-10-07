import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { AddAgentButton } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
const OPEN = { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] as ("RESOLVED" | "CLOSED" | "CANCELLED")[] };

export default async function AgentQueuePage() {
  await pageGuard();
  const [agents, it, agentLoad, itLoad] = await Promise.all([
    prisma.agent.findMany({ select: { id: true, user: { select: { id: true, name: true, email: true, status: true } } } }),
    prisma.user.findMany({ where: { role: "IT_SUPPORT" }, select: { id: true, name: true, email: true, status: true } }),
    prisma.supportTicket.groupBy({ by: ["assignedAgentId"], where: { status: OPEN, assignedAgentId: { not: null } }, _count: true }),
    prisma.supportTicket.groupBy({ by: ["assignedITSupportId"], where: { status: OPEN, assignedITSupportId: { not: null } }, _count: true }),
  ]);
  const a = new Map(agentLoad.map((x) => [x.assignedAgentId, x._count])), i = new Map(itLoad.map((x) => [x.assignedITSupportId, x._count]));
  const rows = [
    ...agents.map((x) => ({ id: x.user.id, name: x.user.name, email: x.user.email, status: x.user.status, type: "Support agent", open: a.get(x.id) ?? 0 })),
    ...it.map((x) => ({ id: x.id, name: x.name, email: x.email, status: x.status, type: "IT specialist", open: i.get(x.id) ?? 0 })),
  ].sort((p, q) => q.open - p.open);
  return (
    <>
      <PageHeader title="Agent Queue" description="Open-ticket load per support person." actions={<AddAgentButton />} />
      <Panel bodyClass="p-0 pb-2"><div className="pt-3">
        <DataTable rowKey={(r) => r.id} rows={rows} empty={<EmptyBlock icon="users" title="No support staff yet" hint="Add a support agent or IT specialist." />}
          columns={[
            { key: "n", header: "Person", render: (r) => <Link href={`/admin/users/${r.id}`} className="font-semibold hover:underline">{r.name}<span className="block text-[11.5px] font-normal" style={{ color: "var(--text-muted)" }}>{r.email}</span></Link> },
            { key: "t", header: "Type", render: (r) => r.type }, { key: "s", header: "Status", render: (r) => <StatusPill value={r.status} /> },
            { key: "o", header: "Open tickets", render: (r) => <b>{r.open}</b> },
          ]} /></div></Panel>
    </>
  );
}
