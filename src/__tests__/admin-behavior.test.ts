import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks: no real DB / NextAuth. Everything below exercises OUR logic. ─────
const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: (...a: unknown[]) => authMock(...a), signOut: vi.fn() }));

const p = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    organization: { count: fn(), groupBy: fn(), findUnique: fn() },
    user: { count: fn(), findUnique: fn(), findFirst: fn() },
    subscriptionPlan: { findMany: fn() },
    organizationSubscription: { count: fn() },
    payment: { aggregate: fn(), groupBy: fn() },
    refund: { aggregate: fn() },
    supportTicket: { count: fn() },
    healthCheck: { groupBy: fn() },
    department: { findFirst: fn() },
    team: { findFirst: fn() },
    $transaction: fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: p }));

import { AuthzError, requireAdminOrPlatformOwner, requirePlatformOwner } from "@/lib/authz";
import { apiGuard } from "@/lib/admin/api";
import { getKpis, getOrganizationsByPlan, revenueTotals } from "@/lib/admin/dashboard";
import { createUserAccount, UserCreateError } from "@/lib/admin/user-accounts";
import { resolveRange } from "@/lib/admin/range";

const RANGE = resolveRange({ range: "this_month" }, new Date("2026-10-05T10:00:00Z"));
const session = (over: Record<string, unknown> = {}) => ({ user: { id: "u1", role: "PLATFORM_OWNER", organizationId: null, mfaEnabled: true, mfaVerified: true, name: "Owner", ...over } });

beforeEach(() => { vi.clearAllMocks(); });

describe("Platform Owner authorization boundary (Phase 2 preserved)", () => {
  it("allows a Platform Owner with MFA verified this session", async () => {
    authMock.mockResolvedValue(session());
    await expect(requirePlatformOwner()).resolves.toBeTruthy();
  });
  it.each(["ADMIN", "AGENT", "CLIENT", "IT_SUPPORT", "ORG_OWNER", "ORG_ADMIN", "EMPLOYEE"])("rejects role %s with 403", async (role) => {
    authMock.mockResolvedValue(session({ role }));
    await expect(requirePlatformOwner()).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a Platform Owner whose MFA is not verified this session (401)", async () => {
    authMock.mockResolvedValue(session({ mfaVerified: false }));
    await expect(requirePlatformOwner()).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a Platform Owner with MFA not enrolled (401)", async () => {
    authMock.mockResolvedValue(session({ mfaEnabled: false, mfaVerified: true }));
    await expect(requirePlatformOwner()).rejects.toMatchObject({ status: 401 });
  });
  it("rejects when signed out", async () => {
    authMock.mockResolvedValue(null);
    await expect(requirePlatformOwner()).rejects.toBeInstanceOf(AuthzError);
  });
  it("requireAdminOrPlatformOwner: ADMIN ok, owner needs MFA, others rejected", async () => {
    authMock.mockResolvedValue(session({ role: "ADMIN" })); await expect(requireAdminOrPlatformOwner()).resolves.toBeTruthy();
    authMock.mockResolvedValue(session({ mfaVerified: false })); await expect(requireAdminOrPlatformOwner()).rejects.toMatchObject({ status: 401 });
    authMock.mockResolvedValue(session({ role: "CLIENT" })); await expect(requireAdminOrPlatformOwner()).rejects.toMatchObject({ status: 403 });
  });
});

describe("apiGuard", () => {
  it("never runs the handler for a non-owner and maps to JSON 403", async () => {
    authMock.mockResolvedValue(session({ role: "ORG_OWNER", organizationId: "org1" }));
    const handler = vi.fn();
    const res = await apiGuard(handler);
    expect(res.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it("401 for unverified MFA, 400 for validation errors", async () => {
    authMock.mockResolvedValue(session({ mfaVerified: false }));
    expect((await apiGuard(async () => new Response())).status).toBe(401);
    authMock.mockResolvedValue(session());
    const { z } = await import("zod");
    const res = await apiGuard(async () => { z.object({ a: z.string() }).parse({}); return new Response(); });
    expect(res.status).toBe(400);
  });
});

describe("revenue accounting (DB-backed aggregation)", () => {
  it("counts only settled statuses and nets refunds; failed/cancelled reported separately", async () => {
    p.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1000 }, _count: 4 })   // gross
      .mockResolvedValueOnce({ _sum: { amount: 300 }, _count: 2 });   // failed
    p.refund.aggregate.mockResolvedValueOnce({ _sum: { amount: 200 }, _count: 1 });
    const t = await revenueTotals(RANGE);
    expect(t).toMatchObject({ gross: 1000, refunds: 200, net: 800, failedCount: 2, failedAmount: 300, paymentCount: 4 });
    const grossWhere = p.payment.aggregate.mock.calls[0][0].where;
    expect(grossWhere.status.in).toEqual(["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"]);
    expect(grossWhere.status.in).not.toContain("FAILED"); expect(grossWhere.status.in).not.toContain("CANCELLED");
    expect(p.refund.aggregate.mock.calls[0][0].where.status).toBe("PROCESSED");
  });
});

describe("zero-data honesty", () => {
  beforeEach(() => {
    for (const m of [p.organization.count, p.user.count, p.organizationSubscription.count, p.supportTicket.count]) m.mockResolvedValue(0);
    p.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
    p.refund.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
    p.healthCheck.groupBy.mockResolvedValue([]);
  });
  it("empty database → real zeros, and uptime says 'Monitoring not configured' (never a fake 99.9%)", async () => {
    const k = Object.fromEntries((await getKpis(RANGE)).map((x) => [x.key, x]));
    expect(k.organizations.value).toBe(0); expect(k.users.value).toBe(0); expect(k.subscriptions.value).toBe(0);
    expect(k.revenue.value).toBe(0); expect(k.tickets.value).toBe(0);
    expect(k.uptime.value).toBeNull(); expect(k.uptime.unavailableReason).toBe("Monitoring not configured");
    expect(k.organizations.delta).toEqual({ pct: 0, direction: "flat" });
  });
  it("uptime is computed from recorded probes only", async () => {
    p.healthCheck.groupBy.mockResolvedValue([{ ok: true, _count: 997 }, { ok: false, _count: 3 }]);
    const k = (await getKpis(RANGE)).find((x) => x.key === "uptime")!;
    expect(k.value).toBe(99.7); expect(k.unavailableReason).toBeUndefined();
  });
  it("open tickets excludes resolved/closed/cancelled; users exclude the Platform Owner", async () => {
    await getKpis(RANGE);
    expect(p.supportTicket.count.mock.calls[0][0].where.status.notIn).toEqual(["RESOLVED", "CLOSED", "CANCELLED"]);
    expect(p.user.count.mock.calls[0][0].where.role).toEqual({ not: "PLATFORM_OWNER" });
  });
});

describe("organizations by plan", () => {
  it("computes counts + percentages from real groupings, names unplanned orgs 'No plan'", async () => {
    p.organization.groupBy.mockResolvedValue([{ planId: "a", _count: 3 }, { planId: "b", _count: 1 }, { planId: null, _count: 1 }]);
    p.subscriptionPlan.findMany.mockResolvedValue([{ id: "a", name: "Business", slug: "business" }, { id: "b", name: "Starter", slug: "starter" }]);
    const r = await getOrganizationsByPlan("all");
    expect(r.total).toBe(5);
    expect(r.slices.map((s) => [s.name, s.count, s.pct])).toEqual([["Business", 3, 60], ["Starter", 1, 20], ["No plan", 1, 20]]);
  });
  it("empty → total 0, no slices", async () => {
    p.organization.groupBy.mockResolvedValue([]); p.subscriptionPlan.findMany.mockResolvedValue([]);
    expect(await getOrganizationsByPlan("all")).toEqual({ total: 0, slices: [] });
  });
});

describe("cross-tenant isolation on user creation", () => {
  const base = { name: "N", email: "n@x.com", role: "EMPLOYEE" as const };
  beforeEach(() => { p.user.findUnique.mockResolvedValue(null); });

  it("rejects a department that belongs to a different organization", async () => {
    p.organization.findUnique.mockResolvedValue({ id: "orgA", status: "ACTIVE", plan: { name: "Pro", features: {} } });
    p.user.count.mockResolvedValue(1);
    p.department.findFirst.mockResolvedValue(null); // lookup is scoped to {organizationId: orgA} → not found
    await expect(createUserAccount({ ...base, organizationId: "orgA", departmentId: "dept-of-orgB" })).rejects.toThrow("Department is not in this organization");
    expect(p.department.findFirst.mock.calls[0][0].where).toEqual({ id: "dept-of-orgB", organizationId: "orgA" });
  });
  it("rejects a manager from another tenant", async () => {
    p.organization.findUnique.mockResolvedValue({ id: "orgA", status: "ACTIVE", plan: null });
    p.user.findFirst.mockResolvedValue(null);
    await expect(createUserAccount({ ...base, organizationId: "orgA", managerId: "mgr-of-orgB" })).rejects.toThrow("Manager is not in this organization");
    expect(p.user.findFirst.mock.calls[0][0].where).toEqual({ id: "mgr-of-orgB", organizationId: "orgA" });
  });
  it("enforces the plan's maxUsers server-side (409)", async () => {
    p.organization.findUnique.mockResolvedValue({ id: "orgA", status: "ACTIVE", plan: { name: "Starter", features: { maxUsers: 5 } } });
    p.user.count.mockResolvedValue(5);
    await expect(createUserAccount({ ...base, organizationId: "orgA" })).rejects.toMatchObject({ status: 409 });
  });
  it("blocks creating Platform Owners, internal roles inside an org, and org roles with no org", async () => {
    await expect(createUserAccount({ ...base, role: "PLATFORM_OWNER" })).rejects.toBeInstanceOf(UserCreateError);
    await expect(createUserAccount({ ...base, role: "ADMIN", organizationId: "orgA" })).rejects.toThrow("internal role");
    await expect(createUserAccount({ ...base, role: "ORG_ADMIN" })).rejects.toThrow("requires an organization");
  });
  it("won't add users to a terminated organization", async () => {
    p.organization.findUnique.mockResolvedValue({ id: "orgA", status: "TERMINATED", plan: null });
    await expect(createUserAccount({ ...base, organizationId: "orgA" })).rejects.toThrow("TERMINATED");
  });
});
