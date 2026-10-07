import { NextRequest, NextResponse } from "next/server";
import { apiGuard } from "@/lib/admin/api";
import { memo } from "@/lib/admin/memo";
import { parseGrouping, resolveRange, toIsoDate } from "@/lib/admin/range";
import {
  getDepartmentOverview, getKpis, getOrganizationsByPlan, getRecentActivities, getRecentTickets,
  getRevenueByService, getRevenueOverview, getTopOrganizations, getUserGrowth, type TopOrgSort,
} from "@/lib/admin/dashboard";

const SECTIONS = ["kpis", "revenue", "users", "plans", "top-orgs", "tickets", "activities", "departments", "services"] as const;

/** GET /api/admin/dashboard?section=<name>&range=&from=&to=&group=  — Platform Owner only. */
export async function GET(req: NextRequest) {
  return apiGuard(async () => {
    const sp = req.nextUrl.searchParams;
    const section = sp.get("section") as (typeof SECTIONS)[number] | null;
    if (!section || !SECTIONS.includes(section)) {
      return NextResponse.json({ error: `section must be one of: ${SECTIONS.join(", ")}` }, { status: 400 });
    }
    const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
    const grouping = parseGrouping(sp.get("group") ?? undefined, range);
    const key = `dash:${section}:${toIsoDate(range.from)}:${toIsoDate(range.to)}:${grouping}:${sp.get("sort") ?? ""}:${sp.get("plan") ?? ""}`;

    const data = await memo(key, 30_000, async () => {
      switch (section) {
        case "kpis": return getKpis(range);
        case "revenue": return getRevenueOverview(range, grouping);
        case "users": return getUserGrowth(range, grouping);
        case "plans": return getOrganizationsByPlan(sp.get("scope") === "active" ? "active" : "all");
        case "top-orgs": return getTopOrganizations(range, (sp.get("sort") as TopOrgSort) ?? "revenue", sp.get("plan") ?? undefined);
        case "tickets": return getRecentTickets();
        case "activities": return getRecentActivities();
        case "departments": return getDepartmentOverview();
        case "services": return getRevenueByService(range);
      }
    });
    return NextResponse.json({ range: { from: range.from, to: range.to, grouping }, data });
  });
}
