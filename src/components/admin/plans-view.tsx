import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable, EmptyBlock, Panel, StatusPill } from "@/components/admin/ui";
import { EditPlanButton } from "@/components/admin/forms";
import { formatINR } from "@/lib/admin/format";

/** Plans table shared by Subscription Plans and Plans & Pricing. */
export async function PlansView() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" }, include: { _count: { select: { organizations: true } } } });
  return (
    <Panel bodyClass="p-0 pb-2"><div className="pt-3">
      <DataTable rowKey={(p) => p.id} rows={plans} empty={<EmptyBlock icon="crown" title="No plans yet" hint="Create your first plan with “+ New plan”." />}
        columns={[
          { key: "n", header: "Plan", render: (p) => <><span className="font-semibold">{p.name}</span><span className="block text-[11.5px] font-mono" style={{ color: "var(--text-muted)" }}>{p.slug}</span></> },
          { key: "m", header: "Monthly", render: (p) => formatINR(Number(p.priceMonthly)) },
          { key: "y", header: "Yearly", render: (p) => (p.priceYearly ? formatINR(Number(p.priceYearly)) : "—") },
          { key: "f", header: "Entitlements", render: (p) => { const f = Object.entries((p.features ?? {}) as Record<string, unknown>); return f.length ? <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{f.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</span> : "—"; } },
          { key: "o", header: "Organizations", render: (p) => <Link href={`/admin/organizations?plan=${p.slug}`} className="adm-link-text">{p._count.organizations}</Link> },
          { key: "a", header: "Status", render: (p) => <StatusPill value={p.active ? "ACTIVE" : "INACTIVE"} /> },
          { key: "e", header: "", render: (p) => <EditPlanButton plan={{ id: p.id, name: p.name, slug: p.slug, priceMonthly: Number(p.priceMonthly), maxUsers: typeof (p.features as Record<string, unknown>)?.maxUsers === "number" ? ((p.features as Record<string, number>).maxUsers) : undefined, active: p.active }} /> },
        ]} /></div>
    </Panel>
  );
}
