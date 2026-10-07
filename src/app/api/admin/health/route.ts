import { NextResponse } from "next/server";
import { apiGuard } from "@/lib/admin/api";
import { getHealthMetrics, runHealthChecks } from "@/lib/admin/health";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  return apiGuard(async () => {
    const [components, metrics] = await Promise.all([runHealthChecks(), getHealthMetrics()]);
    return NextResponse.json({ components, metrics });
  });
}

/** "Run check now" — records a probe that feeds the uptime KPI. */
export async function POST() {
  return apiGuard(async (session) => {
    const components = await runHealthChecks({ record: true });
    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, action: "system.health_check_run",
      entityType: "System", description: "Platform Owner ran a manual health check",
    });
    return NextResponse.json({ components });
  });
}
