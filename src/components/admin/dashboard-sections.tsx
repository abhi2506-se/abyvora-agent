import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/admin/icons";
import { DataTable, EmptyBlock, ErrorState, Panel, PriorityPill, StatusPill, TrendBadge } from "@/components/admin/ui";
import { DonutChart, RevenueChart, UserGrowthChart } from "@/components/admin/charts";
import { ParamSelect } from "@/components/admin/range-picker";
import { QuickActionsGrid } from "@/components/admin/quick-actions";
import { formatINR, formatNumber, initials, relativeTime } from "@/lib/admin/format";
import { memo } from "@/lib/admin/memo";
import { parseGrouping, toIsoDate, type DateRange } from "@/lib/admin/range";
import {
  getDepartmentOverview, getKpis, getOrganizationsByPlan, getRecentActivities, getRecentTickets, getRevenueByService,
  getRevenueOverview, getTopOrganizations, getUserGrowth, type Kpi, type TopOrgSort,
} from "@/lib/admin/dashboard";

export type DashParams = { range: DateRange; group?: string; topSort?: string; topPlan?: string; planScope?: string };

const key = (name: string, p: DashParams, extra = "") => `dash:${name}:${toIsoDate(p.range.from)}:${toIsoDate(p.range.to)}:${extra}`;

/** Runs a loader; on failure logs server-side and returns null so the section renders an error state. */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.error(`[admin dashboard] ${label} failed`, e); return null; }
}

export function SectionSkeleton({ h = 260 }: { h?: number }) {
  return <div className="adm-card p-5" aria-busy="true" aria-label="Loading"><Skeleton style={{ height: 18, width: 160 }} /><Skeleton style={{ height: h, marginTop: 16 }} /></div>;
}

// ── KPI cards ───────────────────────────────────────────────────────────────
const KPI_STYLE: Record<string, { tint: string; icon: string; color: string }> = {
  organizations: { tint: "var(--tint-blue)", icon: "building", color: "#2f6df6" },
  users: { tint: "var(--tint-green)", icon: "users", color: "#16a066" },
  subscriptions: { tint: "var(--tint-violet)", icon: "crown", color: "#7c4dff" },
  revenue: { tint: "var(--tint-orange)", icon: "wallet", color: "#e08a0b" },
  tickets: { tint: "var(--tint-red)", icon: "ticket", color: "#dc3b4b" },
  uptime: { tint: "var(--tint-sky)", icon: "pulse", color: "#2f6df6" },
};

function kpiValue(k: Kpi): string {
  if (k.value === null) return "—";
  return k.kind === "currency" ? formatINR(k.value) : k.kind === "percent" ? `${k.value}%` : formatNumber(k.value);
}

export async function KpiRow({ p }: { p: DashParams }) {
  const kpis = await safe("kpis", () => memo(key("kpis", p), 30_000, () => getKpis(p.range)));
  if (!kpis) return <ErrorState message="Couldn't load the KPI cards." />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
      {kpis.map((k) => {
        const s = KPI_STYLE[k.key];
        return (
          <Link key={k.key} href={k.href} className="adm-kpi" style={{ background: s.tint }} title={k.note}>
            <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface)", color: s.color }}><Icon name={s.icon} size={22} /></span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>{k.label}</span>
              <span className="block text-[24px] font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{kpiValue(k)}</span>
              {k.unavailableReason ? (
                <span className="block text-[11.5px] font-semibold" style={{ color: "var(--warning)" }}>{k.unavailableReason}</span>
              ) : k.delta ? (
                <TrendBadge pct={k.delta.pct} direction={k.delta.direction} goodWhen={k.goodWhen} suffix="vs prev." />
              ) : <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>No prior data</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Revenue overview ────────────────────────────────────────────────────────
const GROUP_OPTIONS = [{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }];

export async function RevenuePanel({ p }: { p: DashParams }) {
  const g = parseGrouping(p.group, p.range);
  const d = await safe("revenue", () => memo(key("revenue", p, g), 30_000, () => getRevenueOverview(p.range, g)));
  return (
    <Panel title="Revenue Overview" action={<ParamSelect param="group" label="Group revenue by" options={GROUP_OPTIONS} fallback={g} />}>
      {!d ? <ErrorState message="Couldn't load revenue." /> : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
            <span className="text-[28px] font-extrabold" style={{ color: "var(--text-primary)" }}>{formatINR(d.current.net)}</span>
            <TrendBadge pct={d.delta.pct} direction={d.delta.direction} suffix="vs previous period" />
          </div>
          <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
            Previous period {formatINR(d.previous.net)} · gross {formatINR(d.current.gross)} · refunds {formatINR(d.current.refunds)}
            {d.current.failedCount > 0 && <> · {d.current.failedCount} failed/cancelled excluded</>}
          </p>
          {d.current.paymentCount === 0 && d.current.refundCount === 0 ? (
            <EmptyBlock icon="wallet" title="No revenue in this period" hint="Settled payments will appear here as they're captured." />
          ) : <RevenueChart series={d.series} grouping={g} />}
        </>
      )}
    </Panel>
  );
}

// ── User growth ─────────────────────────────────────────────────────────────
export async function UserGrowthPanel({ p }: { p: DashParams }) {
  const g = parseGrouping(p.group, p.range);
  const d = await safe("users", () => memo(key("users", p, g), 30_000, () => getUserGrowth(p.range, g)));
  return (
    <Panel title="User Growth">
      {!d ? <ErrorState message="Couldn't load user growth." /> : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
            <span className="text-[28px] font-extrabold" style={{ color: "var(--text-primary)" }}>{formatNumber(d.totalUsers)}</span>
            <TrendBadge pct={d.delta.pct} direction={d.delta.direction} suffix="new users vs prev." />
          </div>
          <div className="flex gap-4 text-[12px] mb-2" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "var(--brand)" }} />New users ({d.newUsers})</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] inline-block opacity-50" style={{ background: "var(--accent)" }} />Active users</span>
          </div>
          {d.newUsers === 0 && d.series.every((s) => s.activeUsers === 0) ? (
            <EmptyBlock icon="users" title="No user activity in this period" />
          ) : <UserGrowthChart series={d.series} grouping={g} />}
        </>
      )}
    </Panel>
  );
}

// ── Organizations by plan ───────────────────────────────────────────────────
export async function PlanPanel({ p }: { p: DashParams }) {
  const scope = p.planScope === "active" ? "active" : "all";
  const d = await safe("plans", () => memo(`dash:plans:${scope}`, 30_000, () => getOrganizationsByPlan(scope)));
  return (
    <Panel title="Organizations by Plan" action={<ParamSelect param="planScope" label="Organization scope" fallback="all" options={[{ value: "all", label: "All orgs" }, { value: "active", label: "Active only" }]} />}>
      {!d ? <ErrorState message="Couldn't load plan distribution." /> : d.total === 0 ? (
        <EmptyBlock icon="crown" title="No organizations yet" hint="Organizations will be grouped by plan once they register." />
      ) : (
        <DonutChart total={d.total} slices={d.slices.map((s) => ({ name: s.name, count: s.count, pct: s.pct, href: s.slug ? `/admin/organizations?plan=${encodeURIComponent(s.slug)}` : "/admin/organizations" }))} />
      )}
    </Panel>
  );
}

// ── Top performing organizations ────────────────────────────────────────────
export async function TopOrgsPanel({ p }: { p: DashParams }) {
  const sort = (["revenue", "users", "growth", "name"].includes(p.topSort ?? "") ? p.topSort : "revenue") as TopOrgSort;
  const plans = await safe("plan-filter", () => getOrganizationsByPlan("all"));
  const rows = await safe("top-orgs", () => memo(key("top", p, `${sort}:${p.topPlan ?? ""}`), 30_000, () => getTopOrganizations(p.range, sort, p.topPlan || undefined)));
  return (
    <Panel title="Top Performing Organizations" bodyClass="p-0 pb-2"
      action={<div className="flex items-center gap-2">
        <ParamSelect param="topPlan" label="Filter by plan" fallback="" options={[{ value: "", label: "All plans" }, ...(plans?.slices.filter((s) => s.slug).map((s) => ({ value: s.slug!, label: s.name })) ?? [])]} />
        <ParamSelect param="topSort" label="Sort by" fallback="revenue" options={[{ value: "revenue", label: "Revenue" }, { value: "users", label: "Users" }, { value: "growth", label: "Growth" }, { value: "name", label: "Name" }]} />
        <Link href="/admin/organizations" className="adm-link-text">View All</Link></div>}>
      <div className="pt-2">
        {!rows ? <div className="px-5 pb-3"><ErrorState message="Couldn't load top organizations." /></div> : (
          <DataTable rowKey={(r) => r.id} rows={rows}
            empty={<EmptyBlock icon="building" title="No ranked organizations yet" hint="Organizations rank here once they have payments or users in the selected period." />}
            columns={[
              { key: "rank", header: "#", render: (r) => r.rank },
              { key: "org", header: "Organization", render: (r) => (
                <Link href={`/admin/organizations/${r.id}`} className="flex items-center gap-2.5 font-semibold hover:underline">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{initials(r.name)}</span>{r.name}
                </Link>) },
              { key: "plan", header: "Plan", render: (r) => r.plan ? <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>{r.plan}</span> : <span style={{ color: "var(--text-muted)" }}>—</span> },
              { key: "users", header: "Users", render: (r) => formatNumber(r.users) },
              { key: "rev", header: "Revenue", render: (r) => formatINR(r.revenue) },
              { key: "growth", header: "Growth", render: (r) => r.growthPct === null ? <span className="text-[12px] font-semibold" style={{ color: "var(--success)" }}>New</span> : <TrendBadge pct={r.growthPct} direction={r.growthPct > 0 ? "up" : r.growthPct < 0 ? "down" : "flat"} /> },
            ]} />
        )}
      </div>
    </Panel>
  );
}

// ── Recent support tickets ──────────────────────────────────────────────────
export async function TicketsPanel() {
  const rows = await safe("tickets", () => getRecentTickets(6));
  return (
    <Panel title="Recent Support Tickets" bodyClass="p-0 pb-2" action={<Link href="/admin/support" className="adm-link-text">View All</Link>}>
      <div className="pt-2">
        {!rows ? <div className="px-5 pb-3"><ErrorState message="Couldn't load tickets." /></div> : (
          <DataTable rowKey={(r) => r.id} rows={rows} empty={<EmptyBlock icon="ticket" title="No support tickets" hint="Tickets raised by organizations and clients appear here." />}
            columns={[
              { key: "n", header: "Ticket", render: (r) => <Link href={`/admin/support/${r.id}`} className="adm-link-text">{r.ticketNumber}</Link> },
              { key: "s", header: "Subject", render: (r) => <Link href={`/admin/support/${r.id}`} className="hover:underline block max-w-[190px] truncate">{r.title}</Link> },
              { key: "o", header: "Organization", render: (r) => <span className="block max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>{r.organization}</span> },
              { key: "st", header: "Status", render: (r) => <StatusPill value={r.status} /> },
              { key: "p", header: "Priority", render: (r) => <PriorityPill value={r.priority} /> },
              { key: "u", header: "Updated", render: (r) => <span className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{relativeTime(r.updatedAt)}</span> },
              { key: "a", header: "Assigned", render: (r) => r.assignee ?? <span style={{ color: "var(--warning)" }}>Unassigned</span> },
            ]} />
        )}
      </div>
    </Panel>
  );
}

// ── Recent activities ───────────────────────────────────────────────────────
const TONE_COLOR = { info: "var(--brand)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", accent: "var(--violet)" } as const;
const TONE_BG = { info: "var(--accent-soft)", success: "var(--success-soft)", warning: "var(--warning-soft)", danger: "var(--danger-soft)", accent: "var(--violet-soft)" } as const;

export async function ActivitiesPanel() {
  const items = await safe("activities", () => getRecentActivities(7));
  return (
    <Panel title="Recent Activities" action={<Link href="/admin/system/audit-logs" className="adm-link-text">View All</Link>}>
      {!items ? <ErrorState message="Couldn't load activity." /> : items.length === 0 ? (
        <EmptyBlock icon="pulse" title="No activity yet" hint="Platform events are recorded in the audit log and shown here." />
      ) : (
        <ul className="space-y-3.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: TONE_BG[a.tone], color: TONE_COLOR[a.tone] }}><Icon name={a.failed ? "alert" : "pulse"} size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{a.title}</div>
                <div className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>{a.detail}</div>
              </div>
              <span className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{relativeTime(a.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Department overview ─────────────────────────────────────────────────────
export async function DepartmentsPanel() {
  const rows = await safe("departments", () => memo("dash:departments", 30_000, getDepartmentOverview));
  return (
    <Panel title="Department Overview (ABYVORA Team)" bodyClass="p-0 pb-2" action={<Link href="/admin/departments" className="adm-link-text">View All</Link>}>
      <div className="pt-2">
        {!rows ? <div className="px-5 pb-3"><ErrorState message="Couldn't load departments." /></div> : (
          <DataTable rowKey={(r) => r.id} rows={rows}
            empty={<EmptyBlock icon="building" title="No ABYVORA departments yet" hint="Create departments and assign staff to see workload here." />}
            columns={[
              { key: "d", header: "Department", render: (r) => <span className="font-semibold">{r.name}</span> },
              { key: "e", header: "Employees", render: (r) => r.employees },
              { key: "a", header: "Active", render: (r) => <span className="inline-flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--success)" }} />{r.active}</span> },
              { key: "w", header: "Workload", render: (r) => (
                <span className="flex items-center gap-2.5 min-w-[130px]">
                  <span className="text-[12px] w-9">{r.workloadPct}%</span>
                  <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}><span className="block h-full rounded-full" style={{ width: `${r.workloadPct}%`, background: "var(--brand)" }} /></span>
                </span>) },
            ]} />
        )}
      </div>
    </Panel>
  );
}

// ── Revenue by service ──────────────────────────────────────────────────────
const BAR = ["#2f6df6", "#16c47f", "#7c4dff", "#f6a21e", "#e5484d", "#06b6d4"];
export async function ServicesPanel({ p }: { p: DashParams }) {
  const d = await safe("services", () => memo(key("services", p), 30_000, () => getRevenueByService(p.range, 6)));
  return (
    <Panel title="Revenue by Service">
      {!d ? <ErrorState message="Couldn't load service revenue." /> : d.rows.length === 0 ? (
        <EmptyBlock icon="box" title="No service revenue in this period" hint="Grouped by the project type each settled payment belongs to." />
      ) : (
        <>
        <p className="text-[11.5px] -mt-1 mb-3" style={{ color: "var(--text-muted)" }}>Settled payments in the period, before refunds. Grouped by project type.</p>
        <ul className="space-y-3.5">
          {d.rows.map((r, i) => (
            <li key={r.service} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.3fr)_auto_minmax(80px,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[13px]">
              <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.service}</span>
              <span className="font-semibold text-right">{formatINR(r.revenue)}</span>
              <span className="h-1.5 rounded-full overflow-hidden col-span-2 sm:col-span-1" style={{ background: "var(--border)" }}><span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: BAR[i % BAR.length] }} /></span>
              <span className="text-[12px] w-10 text-right hidden sm:block" style={{ color: "var(--text-secondary)" }}>{Math.round(r.pct)}%</span>
            </li>
          ))}
        </ul>
        </>
      )}
    </Panel>
  );
}

export function QuickActionsPanel() {
  return <Panel title="Quick Actions"><QuickActionsGrid /></Panel>;
}

export function Lazy({ children, h }: { children: React.ReactNode; h?: number }) {
  return <Suspense fallback={<SectionSkeleton h={h} />}>{children}</Suspense>;
}
