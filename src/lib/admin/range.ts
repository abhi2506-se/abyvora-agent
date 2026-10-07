/**
 * Pure date-range / grouping / comparison helpers for the Platform Owner
 * dashboard. No Prisma, no Next — fully unit-testable.
 *
 * All boundaries are UTC and half-open: [from, to). This keeps SQL
 * (`>= from AND < to`) and in-JS bucketing in exact agreement.
 */

export type Grouping = "day" | "week" | "month";
export type RangePreset =
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export type DateRange = { from: Date; to: Date; preset: RangePreset };

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const DAY = 24 * 60 * 60 * 1000;

/** A Date `ms` before now. Lives here (not inline in pages) so page components stay render-pure. */
export function msAgo(ms: number, now: number = Date.now()): Date {
  return new Date(now - ms);
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

function monthStart(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1));
}

/** Parses a `YYYY-MM-DD` string to a UTC midnight Date, or null if invalid. */
export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MAX_RANGE_DAYS = 366 * 3;

/**
 * Resolves query-string params into a concrete range. Invalid or oversized
 * input never throws — it falls back to "this month" so a hand-edited URL
 * can't crash (or hammer) the dashboard.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date()
): DateRange {
  const today = startOfUtcDay(now);
  const tomorrow = addDays(today, 1);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  switch (params.range as RangePreset | undefined) {
    case "7d":
      return { from: addDays(tomorrow, -7), to: tomorrow, preset: "7d" };
    case "30d":
      return { from: addDays(tomorrow, -30), to: tomorrow, preset: "30d" };
    case "last_month":
      return { from: monthStart(y, m - 1), to: monthStart(y, m), preset: "last_month" };
    case "this_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: monthStart(y, qStart), to: tomorrow, preset: "this_quarter" };
    }
    case "this_year":
      return { from: monthStart(y, 0), to: tomorrow, preset: "this_year" };
    case "custom": {
      const from = parseIsoDate(params.from);
      const toInclusive = parseIsoDate(params.to);
      if (from && toInclusive && toInclusive >= from) {
        const to = addDays(toInclusive, 1);
        if ((to.getTime() - from.getTime()) / DAY <= MAX_RANGE_DAYS) {
          return { from, to, preset: "custom" };
        }
      }
      break;
    }
  }
  return { from: monthStart(y, m), to: tomorrow, preset: "this_month" };
}

/** The immediately preceding window of identical length. */
export function previousRange(range: DateRange): DateRange {
  const len = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - len),
    to: new Date(range.from.getTime()),
    preset: "custom",
  };
}

export function rangeDays(range: DateRange): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY));
}

export function defaultGrouping(range: DateRange): Grouping {
  const days = rangeDays(range);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export function parseGrouping(value: string | undefined, range: DateRange): Grouping {
  return value === "day" || value === "week" || value === "month" ? value : defaultGrouping(range);
}

/** Start of the bucket (UTC) containing `d`, matching Postgres date_trunc (weeks start Monday). */
export function bucketStart(d: Date, grouping: Grouping): Date {
  const day = startOfUtcDay(d);
  if (grouping === "day") return day;
  if (grouping === "month") return monthStart(day.getUTCFullYear(), day.getUTCMonth());
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

export function bucketKey(d: Date, grouping: Grouping): string {
  return toIsoDate(bucketStart(d, grouping));
}

/** Every bucket start covering the range, so charts show zeros instead of gaps. */
export function listBuckets(range: DateRange, grouping: Grouping): Date[] {
  const out: Date[] = [];
  let cur = bucketStart(range.from, grouping);
  const guard = 2000;
  while (cur < range.to && out.length < guard) {
    out.push(cur);
    cur =
      grouping === "day"
        ? addDays(cur, 1)
        : grouping === "week"
          ? addDays(cur, 7)
          : monthStart(cur.getUTCFullYear(), cur.getUTCMonth() + 1);
  }
  return out;
}

/** Merges sparse `{bucket -> value}` rows into a dense, ordered series. */
export function densify(
  range: DateRange,
  grouping: Grouping,
  rows: { bucket: Date | string; value: number }[]
): { bucket: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(typeof r.bucket === "string" ? new Date(r.bucket) : r.bucket, grouping);
    map.set(key, (map.get(key) ?? 0) + r.value);
  }
  return listBuckets(range, grouping).map((b) => ({ bucket: toIsoDate(b), value: map.get(toIsoDate(b)) ?? 0 }));
}

export type Delta = {
  /** null means "no baseline" (previous was 0 and current is not). */
  pct: number | null;
  direction: "up" | "down" | "flat";
};

export function computeDelta(current: number, previous: number): Delta {
  if (current === previous) return { pct: 0, direction: "flat" };
  if (previous === 0) return { pct: null, direction: current > 0 ? "up" : "down" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, direction: pct > 0 ? "up" : "down" };
}

export function rangeLabel(range: DateRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(range.from)} – ${fmt(addDays(range.to, -1))}`;
}
