import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import { EditPlanButton } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function FeatureControlPage() {
  await pageGuard();
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" } });
  const keys = [...new Set(plans.flatMap((p) => Object.keys((p.features ?? {}) as object)))].sort();
  const show = (v: unknown) => (v === true ? "✓" : v === false || v === undefined ? "—" : String(v));
  return (
    <>
      <PageHeader title="Feature Control" description="Entitlements per plan. Edit a plan to change them; limits such as maxUsers are enforced server-side." />
      <Panel bodyClass="p-0 pb-2">
        {plans.length === 0 ? <EmptyBlock icon="toggle" title="No plans yet" /> : (
          <div className="overflow-x-auto pt-2"><table className="adm-table"><thead><tr><th>Feature</th>{plans.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
            <tbody>{keys.length === 0 ? <tr><td colSpan={plans.length + 1}>No entitlements defined on any plan.</td></tr> : keys.map((k) => (<tr key={k}><td className="font-mono text-[12px]">{k}</td>{plans.map((p) => <td key={p.id}>{show(((p.features ?? {}) as Record<string, unknown>)[k])}</td>)}</tr>))}
              <tr><td /> {plans.map((p) => <td key={p.id}><EditPlanButton plan={{ id: p.id, name: p.name, slug: p.slug, priceMonthly: Number(p.priceMonthly), maxUsers: typeof (p.features as Record<string, unknown>)?.maxUsers === "number" ? (p.features as Record<string, number>).maxUsers : undefined, active: p.active }} /></td>)}</tr></tbody></table></div>)}
      </Panel>
    </>
  );
}
