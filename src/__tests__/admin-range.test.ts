import { describe, it, expect } from "vitest";
import { addDays, bucketKey, computeDelta, defaultGrouping, densify, listBuckets, parseIsoDate, previousRange, resolveRange, toIsoDate } from "@/lib/admin/range";

const NOW = new Date("2026-10-05T10:30:00Z");

describe("resolveRange", () => {
  it("this_month: from 1st to end of today (half-open)", () => {
    const r = resolveRange({ range: "this_month" }, NOW);
    expect(toIsoDate(r.from)).toBe("2026-10-01");
    expect(toIsoDate(r.to)).toBe("2026-10-06");
  });
  it("last_month covers the full previous month", () => {
    const r = resolveRange({ range: "last_month" }, NOW);
    expect(toIsoDate(r.from)).toBe("2026-09-01");
    expect(toIsoDate(r.to)).toBe("2026-10-01");
  });
  it("this_quarter starts at the quarter's first month", () => {
    expect(toIsoDate(resolveRange({ range: "this_quarter" }, NOW).from)).toBe("2026-10-01");
    expect(toIsoDate(resolveRange({ range: "this_quarter" }, new Date("2026-05-20T00:00:00Z")).from)).toBe("2026-04-01");
  });
  it("custom range is inclusive of the 'to' day", () => {
    const r = resolveRange({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, NOW);
    expect(toIsoDate(r.to)).toBe("2026-10-01");
  });
  it("falls back safely on garbage, reversed, or oversized custom input", () => {
    for (const p of [{ range: "custom", from: "nope", to: "x" }, { range: "custom", from: "2026-09-10", to: "2026-09-01" }, { range: "custom", from: "2000-01-01", to: "2026-01-01" }, { range: "'; DROP TABLE" }]) {
      expect(resolveRange(p, NOW).preset).toBe("this_month");
    }
  });
});

describe("previousRange", () => {
  it("is the adjacent window of identical length", () => {
    const r = resolveRange({ range: "7d" }, NOW);
    const p = previousRange(r);
    expect(p.to.getTime()).toBe(r.from.getTime());
    expect(p.to.getTime() - p.from.getTime()).toBe(r.to.getTime() - r.from.getTime());
  });
});

describe("computeDelta", () => {
  it("computes percent change with one decimal", () => expect(computeDelta(118, 100)).toEqual({ pct: 18, direction: "up" }));
  it("handles decreases", () => expect(computeDelta(50, 80)).toEqual({ pct: -37.5, direction: "down" }));
  it("flat when equal (including 0 vs 0)", () => { expect(computeDelta(0, 0).direction).toBe("flat"); expect(computeDelta(5, 5).pct).toBe(0); });
  it("no baseline → pct null, never Infinity", () => expect(computeDelta(7, 0)).toEqual({ pct: null, direction: "up" }));
});

describe("grouping & buckets", () => {
  it("picks day/week/month by span", () => {
    expect(defaultGrouping(resolveRange({ range: "30d" }, NOW))).toBe("day");
    expect(defaultGrouping(resolveRange({ range: "this_quarter" }, new Date("2026-12-20T00:00:00Z")))).toBe("week");
    expect(defaultGrouping(resolveRange({ range: "this_year" }, NOW))).toBe("month");
  });
  it("weeks start on Monday", () => expect(bucketKey(new Date("2026-10-07T12:00:00Z"), "week")).toBe("2026-10-05"));
  it("densify fills empty buckets with zero and sums duplicates", () => {
    const r = resolveRange({ range: "custom", from: "2026-10-01", to: "2026-10-04" }, NOW);
    const out = densify(r, "day", [{ bucket: new Date("2026-10-02T05:00:00Z"), value: 5 }, { bucket: new Date("2026-10-02T20:00:00Z"), value: 3 }]);
    expect(out.map((o) => o.value)).toEqual([0, 8, 0, 0]);
  });
  it("month buckets across a year boundary", () => {
    const r = resolveRange({ range: "custom", from: "2026-11-15", to: "2027-01-10" }, NOW);
    expect(listBuckets(r, "month").map(toIsoDate)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
  it("parseIsoDate rejects invalid dates", () => { expect(parseIsoDate("2026-13-45")).toBeNull(); expect(parseIsoDate("2026-02-03")).not.toBeNull(); });
  it("addDays", () => expect(toIsoDate(addDays(new Date("2026-10-31T00:00:00Z"), 1))).toBe("2026-11-01"));
});
