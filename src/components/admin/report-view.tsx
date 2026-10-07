import { Suspense } from "react";
import Link from "next/link";
import { DataTable, EmptyBlock, PageHeader, Panel } from "@/components/admin/ui";
import { RangePicker, ParamSelect } from "@/components/admin/range-picker";
import { buildReport, CUSTOM_DATASETS, type CustomDataset, type ReportType } from "@/lib/admin/reports";
import { first, type SP } from "@/lib/admin/paging";
import { parseGrouping, rangeLabel, resolveRange, toIsoDate } from "@/lib/admin/range";

const PREVIEW_ROWS = 200;

/** Renders any report from the shared engine with a range picker and an (audited) CSV export. */
export async function ReportView({ type, sp, base, group }: { type: ReportType; sp: SP; base: string; group?: string }) {
  const range = resolveRange({ range: first(sp.range), from: first(sp.from), to: first(sp.to) });
  const g = parseGrouping(group, range);
  const ds = first(sp.dataset);
  const dataset = (CUSTOM_DATASETS as readonly string[]).includes(ds ?? "") ? (ds as CustomDataset) : undefined;
  const report = await buildReport(type, range, g, { dataset });
  const qs = new URLSearchParams({ type, range: first(sp.range) ?? "this_month", group: g });
  if (first(sp.from)) qs.set("from", first(sp.from)!);
  if (first(sp.to)) qs.set("to", first(sp.to)!);
  if (dataset) qs.set("dataset", dataset);
  const shown = report.rows.slice(0, PREVIEW_ROWS);
  return (
    <>
      <PageHeader title={report.title} description={report.description}
        actions={<>
          <Suspense><RangePicker label={rangeLabel(range)} /></Suspense>
          {["business", "financial"].includes(type) && <ParamSelect param="group" label="Group by" fallback={g} options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />}
          <a href={`/api/admin/reports/export?${qs}`} className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>Export CSV</a>
        </>} />
      {type === "custom" && (
        <div className="flex flex-wrap gap-2 mb-4">
          {CUSTOM_DATASETS.map((d) => {
            const q = new URLSearchParams({ ...(first(sp.range) ? { range: first(sp.range)! } : {}), ...(first(sp.from) ? { from: first(sp.from)! } : {}), ...(first(sp.to) ? { to: first(sp.to)! } : {}), dataset: d });
            const on = (dataset ?? "organizations") === d;
            return <Link key={d} href={`${base}?${q}`} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold capitalize" style={on ? { background: "var(--brand)", color: "#fff" } : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{d}</Link>;
          })}
        </div>
      )}
      <Panel bodyClass="p-0 pb-2">
        <div className="pt-3">
          <DataTable rowKey={(r) => String(r.idx)} rows={shown.map((r, idx) => ({ idx, cells: r }))} empty={<EmptyBlock icon="chart" title="No data in this period" hint="Try a wider date range." />}
            columns={report.columns.map((c, i) => ({ key: String(i), header: c, render: (row: { cells: (string | number | boolean | Date | null | undefined)[] }) => { const v = row.cells[i]; return v instanceof Date ? toIsoDate(v) : typeof v === "number" ? v.toLocaleString("en-IN") : v === null || v === undefined || v === "" ? "—" : String(v); } }))} />
        </div>
        <p className="px-5 pt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>{report.rows.length > PREVIEW_ROWS ? `Showing first ${PREVIEW_ROWS} of ${report.rows.length} rows — export for the full set.` : `${report.rows.length} row${report.rows.length === 1 ? "" : "s"}.`}{report.note ? ` ${report.note}` : ""}</p>
      </Panel>
    </>
  );
}
