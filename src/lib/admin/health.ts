import { prisma } from "@/lib/prisma";

export type ComponentStatus = "operational" | "degraded" | "down" | "not_configured";
export type HealthComponent = {
  key: string;
  name: string;
  status: ComponentStatus;
  detail: string;
  latencyMs?: number;
};

const configured = (...vars: string[]) => vars.every((v) => !!process.env[v]);

/**
 * Runs the checks that can be measured honestly from inside the app, and
 * records the database/application probes that feed the uptime KPI.
 * Anything with no real signal reports "not_configured" — never a guess.
 */
export async function runHealthChecks(opts: { record?: boolean } = {}): Promise<HealthComponent[]> {
  const out: HealthComponent[] = [];

  // Database — real round-trip.
  const t0 = Date.now();
  let dbOk = true;
  let dbDetail = "Query round-trip succeeded";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    dbOk = false;
    dbDetail = e instanceof Error ? e.message.slice(0, 160) : "Database unreachable";
  }
  const dbLatency = Date.now() - t0;
  out.push({
    key: "database",
    name: "Database",
    status: !dbOk ? "down" : dbLatency > 1000 ? "degraded" : "operational",
    detail: dbDetail,
    latencyMs: dbLatency,
  });

  // Application — this code is executing, so the process is serving.
  out.push({ key: "application", name: "Application", status: "operational", detail: "Server process responding" });

  // Configuration-only signals (we can see if they're set up, not if the vendor is up).
  out.push({
    key: "payments",
    name: "Payment gateway (Razorpay)",
    status: configured("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET") ? "operational" : "not_configured",
    detail: configured("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET")
      ? "API keys present (vendor availability not probed)"
      : "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set",
  });
  out.push({
    key: "webhooks",
    name: "Payment webhooks",
    status: configured("RAZORPAY_WEBHOOK_SECRET") ? "operational" : "not_configured",
    detail: configured("RAZORPAY_WEBHOOK_SECRET")
      ? "Signing secret present; signatures verified server-side"
      : "RAZORPAY_WEBHOOK_SECRET not set — webhooks cannot be verified",
  });
  out.push({
    key: "email",
    name: "Email (Resend)",
    status: configured("RESEND_API_KEY") ? "operational" : "not_configured",
    detail: configured("RESEND_API_KEY") ? "API key present" : "RESEND_API_KEY not set",
  });
  const local = process.env.STORAGE_PROVIDER === "local";
  const supa = configured("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  out.push({
    key: "storage",
    name: "File storage",
    status: local || supa ? "operational" : "not_configured",
    detail: local ? "Local disk storage selected (not suitable for multi-instance production)" : supa ? "Supabase storage credentials present (vendor availability not probed)" : "Neither Supabase nor local storage is configured",
  });
  out.push({
    key: "jobs",
    name: "Background jobs",
    status: "not_configured",
    detail: "No job runner is wired to this app — monitoring not configured",
  });

  if (opts.record) {
    await prisma.healthCheck.createMany({
      data: [
        { component: "database", ok: dbOk, latencyMs: dbLatency, detail: dbDetail.slice(0, 200) },
        { component: "application", ok: true, detail: "ok" },
      ],
    });
  }
  return out;
}

export async function getHealthMetrics() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [probes24h, latency, audit24h, auditFailed24h, lastProbe, lastWebhookPayment, invalidSig] = await Promise.all([
    prisma.healthCheck.count({ where: { component: "database", checkedAt: { gte: since } } }),
    prisma.healthCheck.aggregate({ where: { component: "database", checkedAt: { gte: since } }, _avg: { latencyMs: true } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since }, status: "FAILED" } }),
    prisma.healthCheck.findFirst({ orderBy: { checkedAt: "desc" }, select: { checkedAt: true } }),
    prisma.payment.findFirst({ where: { status: "CAPTURED" }, orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
    prisma.auditLog.count({ where: { action: "webhook.razorpay.invalid_signature", createdAt: { gte: since } } }),
  ]);
  return {
    probes24h,
    avgLatencyMs: latency._avg.latencyMs ? Math.round(latency._avg.latencyMs) : null,
    errorRatePct: audit24h ? Math.round((auditFailed24h / audit24h) * 1000) / 10 : null,
    auditEvents24h: audit24h,
    auditFailed24h,
    lastProbeAt: lastProbe?.checkedAt ?? null,
    lastCapturedPaymentAt: lastWebhookPayment?.paidAt ?? null,
    invalidWebhookSignatures24h: invalidSig,
  };
}
