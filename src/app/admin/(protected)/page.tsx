import { requirePlatformOwner } from "@/lib/authz";
import { RangePicker } from "@/components/admin/range-picker";
import { QuickActionsMenu } from "@/components/admin/quick-actions";
import { rangeLabel, resolveRange } from "@/lib/admin/range";
import { first, type SP } from "@/lib/admin/paging";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import {
  ActivitiesPanel, DepartmentsPanel, KpiRow, Lazy, PlanPanel, QuickActionsPanel, RevenuePanel, ServicesPanel,
  TicketsPanel, TopOrgsPanel, UserGrowthPanel, type DashParams,
} from "@/components/admin/dashboard-sections";

export const dynamic = "force-dynamic";

/** Platform Owner home — the real control-plane dashboard. */
export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePlatformOwner();
  const sp = await searchParams;
  const range = resolveRange({ range: first(sp.range), from: first(sp.from), to: first(sp.to) });
  const p: DashParams = { range, group: first(sp.group), topSort: first(sp.topSort), topPlan: first(sp.topPlan), planScope: first(sp.planScope) };
  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>Hello {firstName}, <span aria-hidden>👋</span></h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>Here&apos;s the complete overview of ABYVORA platform.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Suspense fallback={<Skeleton style={{ height: 40, width: 220 }} />}><RangePicker label={rangeLabel(range)} /></Suspense>
            <QuickActionsMenu />
          </div>
          <p className="text-[12.5px] italic text-right hidden md:block" style={{ color: "var(--text-secondary)" }}>“Empowering organizations to grow globally.”<br /><span className="not-italic font-semibold">— ABYVORA</span></p>
        </div>
      </div>

      <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ height: 96, borderRadius: 14 }} />)}</div>}>
        <KpiRow p={p} />
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5"><Lazy><RevenuePanel p={p} /></Lazy></div>
        <div className="xl:col-span-4"><Lazy><UserGrowthPanel p={p} /></Lazy></div>
        <div className="xl:col-span-3"><Lazy><PlanPanel p={p} /></Lazy></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4"><Lazy h={220}><TopOrgsPanel p={p} /></Lazy></div>
        <div className="xl:col-span-5"><Lazy h={220}><TicketsPanel /></Lazy></div>
        <div className="xl:col-span-3"><Lazy h={220}><ActivitiesPanel /></Lazy></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4"><Lazy h={200}><DepartmentsPanel /></Lazy></div>
        <div className="xl:col-span-5"><Lazy h={200}><ServicesPanel p={p} /></Lazy></div>
        <div className="xl:col-span-3"><QuickActionsPanel /></div>
      </div>
    </div>
  );
}
