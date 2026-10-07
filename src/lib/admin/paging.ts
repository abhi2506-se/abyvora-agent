/** Pure pagination / query-param helpers shared by every list page. */
export const PAGE_SIZE = 25;

export type SP = Record<string, string | string[] | undefined>;

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parsePage(v: string | undefined): number {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : 1;
}

export function pageArgs(page: number, size = PAGE_SIZE) {
  return { skip: (page - 1) * size, take: size };
}

export function totalPages(total: number, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / size));
}

/** Picks `value` only if it is one of `allowed` (enum-safe filter input). */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function sortDir(v: string | undefined): "asc" | "desc" {
  return v === "asc" ? "asc" : "desc";
}
