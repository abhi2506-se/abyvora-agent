import { describe, it, expect } from "vitest";
import { isRevenueStatus, netRevenue, REVENUE_PAYMENT_STATUSES, FAILED_PAYMENT_STATUSES } from "@/lib/admin/revenue";
import { breachedWhere, slaDeadline, slaState, SLA_HOURS } from "@/lib/admin/sla";
import { buildTree, countNodes } from "@/lib/admin/tree";
import { describeAction, isSecurityAction } from "@/lib/admin/activity-labels";
import { cleanQuery } from "@/lib/admin/query";
import { oneOf, pageArgs, parsePage, totalPages } from "@/lib/admin/paging";
import { formatINR, relativeTime } from "@/lib/admin/format";

describe("revenue accounting", () => {
  it("counts only settled payments as revenue", () => {
    for (const s of REVENUE_PAYMENT_STATUSES) expect(isRevenueStatus(s)).toBe(true);
    for (const s of [...FAILED_PAYMENT_STATUSES, "CREATED", "PENDING", "AUTHORIZED"]) expect(isRevenueStatus(s)).toBe(false);
  });
  it("net = gross − refunds without float drift", () => expect(netRevenue(0.3, 0.1)).toBe(0.2));
});

describe("SLA", () => {
  const created = new Date("2026-10-01T00:00:00Z");
  it("deadline per priority", () => expect(slaDeadline(created, "HIGH").getTime() - created.getTime()).toBe(SLA_HOURS.HIGH * 3600000));
  it("ok → at_risk → breached", () => {
    expect(slaState(created, "HIGH", new Date("2026-10-01T05:00:00Z")).state).toBe("ok");
    expect(slaState(created, "HIGH", new Date("2026-10-01T20:00:00Z")).state).toBe("at_risk");
    expect(slaState(created, "HIGH", new Date("2026-10-02T01:00:00Z")).state).toBe("breached");
  });
  it("breachedWhere excludes resolved statuses", () => expect(breachedWhere().status.notIn).toEqual(["RESOLVED", "CLOSED", "CANCELLED"]));
});

describe("org chart tree", () => {
  it("nests reports under managers and sorts", () => {
    const t = buildTree([{ id: "c", name: "C", role: "EMPLOYEE", managerId: "b" }, { id: "a", name: "A", role: "ORG_OWNER", managerId: null }, { id: "b", name: "B", role: "MID_MANAGER", managerId: "a" }]);
    expect(t).toHaveLength(1); expect(t[0].reports[0].reports[0].id).toBe("c"); expect(countNodes(t)).toBe(3);
  });
  it("treats an out-of-scope manager as root", () => expect(buildTree([{ id: "x", name: "X", role: "EMPLOYEE", managerId: "ghost" }])).toHaveLength(1));
  it("survives a manager cycle without hanging or losing people", () => {
    const t = buildTree([{ id: "a", name: "A", role: "X", managerId: "b" }, { id: "b", name: "B", role: "X", managerId: "a" }]);
    expect(countNodes(t)).toBe(2);
  });
});

describe("activity labels", () => {
  it("maps known audit actions", () => { expect(describeAction("organization.approved").title).toBe("Organization approved"); expect(describeAction("refund.processed").tone).toBe("warning"); });
  it("never drops unknown actions", () => expect(describeAction("brand_new.thing").title).toBe("Brand New Thing"));
  it("flags security actions", () => { expect(isSecurityAction("mfa.failed")).toBe(true); expect(isSecurityAction("plan.created")).toBe(false); });
});

describe("search + paging + format helpers", () => {
  it("cleanQuery rejects too-short and caps length", () => { expect(cleanQuery(" a ")).toBeNull(); expect(cleanQuery("x".repeat(500))!.length).toBe(80); });
  it("oneOf only allows whitelisted values", () => { expect(oneOf("ACTIVE", ["ACTIVE"] as const)).toBe("ACTIVE"); expect(oneOf("x'; --", ["ACTIVE"] as const)).toBeUndefined(); });
  it("page params are sanitized", () => { expect(parsePage("-3")).toBe(1); expect(parsePage("abc")).toBe(1); expect(parsePage("4")).toBe(4); expect(pageArgs(3, 25)).toEqual({ skip: 50, take: 25 }); expect(totalPages(0)).toBe(1); expect(totalPages(51)).toBe(3); });
  it("formats INR in lakh grouping", () => expect(formatINR(5243000)).toContain("52,43,000"));
  it("relative time", () => expect(relativeTime(new Date(Date.now() - 12 * 60000))).toBe("12 mins ago"));
});
