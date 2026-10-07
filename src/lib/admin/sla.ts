/**
 * Resolution-SLA rules for the SLA Monitor + notifications. Pure so the same
 * definition is used by SQL filters, UI badges and tests.
 * (The schema stores no first-response timestamp, so the SLA measured here is
 * time-to-resolution from ticket creation.)
 */
export type SlaPriority = "LOW" | "MEDIUM" | "HIGH";

export const SLA_HOURS: Record<SlaPriority, number> = { HIGH: 24, MEDIUM: 72, LOW: 168 };

export function slaDeadline(createdAt: Date, priority: SlaPriority): Date {
  return new Date(createdAt.getTime() + SLA_HOURS[priority] * 3600 * 1000);
}

export type SlaState = "ok" | "at_risk" | "breached";

/** at_risk = more than 75% of the window consumed. */
export function slaState(createdAt: Date, priority: SlaPriority, now: Date = new Date()): { state: SlaState; hoursLeft: number } {
  const deadline = slaDeadline(createdAt, priority).getTime();
  const left = (deadline - now.getTime()) / 3600000;
  const window = SLA_HOURS[priority];
  if (left <= 0) return { state: "breached", hoursLeft: Math.round(left * 10) / 10 };
  return { state: left < window * 0.25 ? "at_risk" : "ok", hoursLeft: Math.round(left * 10) / 10 };
}

/** Prisma `where` fragment: open tickets already past their SLA window. */
export function breachedWhere(now: Date = new Date()) {
  return {
    status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] as ("RESOLVED" | "CLOSED" | "CANCELLED")[] },
    OR: (Object.keys(SLA_HOURS) as SlaPriority[]).map((p) => ({
      priority: p,
      createdAt: { lt: new Date(now.getTime() - SLA_HOURS[p] * 3600 * 1000) },
    })),
  };
}
