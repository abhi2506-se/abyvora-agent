import { NextRequest, NextResponse } from "next/server";
import { apiGuard, badRequest } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";

type Opt = { value: string; label: string };
const KINDS = ["plans", "orgs", "departments", "teams", "managers", "agents", "it", "tickets", "projects"] as const;

/** Lazy dropdown data for the quick-action forms. Platform Owner only; capped lists. */
export async function GET(req: NextRequest) {
  return apiGuard(async () => {
    const kind = req.nextUrl.searchParams.get("kind") as (typeof KINDS)[number] | null;
    const orgId = req.nextUrl.searchParams.get("orgId") || null; // used only as a filter, platform-wide read anyway
    if (!kind || !KINDS.includes(kind)) return badRequest("Unknown option kind");
    let options: Opt[] = [];
    switch (kind) {
      case "plans":
        options = (await prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceMonthly: "asc" }, select: { id: true, name: true } })).map((p) => ({ value: p.id, label: p.name }));
        break;
      case "orgs":
        options = (await prisma.organization.findMany({ where: { status: { notIn: ["TERMINATED", "REJECTED"] } }, orderBy: { name: "asc" }, take: 500, select: { id: true, name: true } })).map((o) => ({ value: o.id, label: o.name }));
        break;
      case "departments":
        options = (await prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true } })).map((d) => ({ value: d.id, label: d.name }));
        break;
      case "teams":
        options = (await prisma.team.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true } })).map((d) => ({ value: d.id, label: d.name }));
        break;
      case "managers":
        options = (await prisma.user.findMany({ where: { organizationId: orgId, status: "ACTIVE", role: { not: "PLATFORM_OWNER" } }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true, role: true } })).map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }));
        break;
      case "agents":
        options = (await prisma.agent.findMany({ where: { user: { status: "ACTIVE" } }, take: 200, select: { id: true, user: { select: { name: true } } } })).map((a) => ({ value: a.id, label: a.user.name }));
        break;
      case "it":
        options = (await prisma.user.findMany({ where: { role: "IT_SUPPORT", status: "ACTIVE" }, take: 200, select: { id: true, name: true } })).map((u) => ({ value: u.id, label: u.name }));
        break;
      case "tickets":
        options = (await prisma.supportTicket.findMany({ where: { status: { in: ["ADMIN_REVIEW", "ESCALATION_REJECTED"] } }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, ticketNumber: true, title: true } })).map((t) => ({ value: t.id, label: `${t.ticketNumber} — ${t.title.slice(0, 50)}` }));
        break;
      case "projects":
        options = (await prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, client: { select: { name: true } } } })).map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` }));
        break;
    }
    return NextResponse.json({ options });
  });
}
