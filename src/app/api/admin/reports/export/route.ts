import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest } from "@/lib/admin/api";
import { buildReport, CUSTOM_DATASETS, REPORT_TYPES, type CustomDataset, type ReportType } from "@/lib/admin/reports";
import { toCsv } from "@/lib/admin/csv";
import { parseGrouping, resolveRange, toIsoDate } from "@/lib/admin/range";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

/** CSV export of any report. Exports are sensitive-data egress, so every one is audited. */
export async function GET(req: NextRequest) {
  return apiGuard(async (session) => {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") as ReportType | null;
    if (!type || !REPORT_TYPES.includes(type)) return badRequest("Unknown report type");
    const rl = checkRateLimit(`export:${session.user.id}`, 20, 10 * 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Too many exports — try again shortly" }, { status: 429 });

    const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
    const ds = sp.get("dataset") as CustomDataset | null;
    const report = await buildReport(type, range, parseGrouping(sp.get("group") ?? undefined, range), { dataset: ds && CUSTOM_DATASETS.includes(ds) ? ds : undefined });
    const csv = toCsv(report.columns, report.rows);

    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "export.report", entityType: "Report", entityId: type,
      description: `Exported ${report.title} (${report.rows.length} rows)`, metadata: { type, dataset: ds, from: toIsoDate(range.from), to: toIsoDate(range.to), rows: report.rows.length },
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="abyvora-${type}-${toIsoDate(range.from)}_${toIsoDate(range.to)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
