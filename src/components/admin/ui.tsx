import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { statusTone, formatStatus } from "@/lib/status-tone";
import { Icon } from "@/components/admin/icons";
import { RetryButton } from "@/components/admin/retry-button";
import { PAGE_SIZE, totalPages, type SP } from "@/lib/admin/paging";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{title}</h1>
        {description && <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "", bodyClass = "p-5" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`adm-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatusPill({ value }: { value: string }) {
  return <Badge tone={statusTone(value)} dot>{formatStatus(value)}</Badge>;
}

const PRIORITY_TONE = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" } as const;
export function PriorityPill({ value }: { value: keyof typeof PRIORITY_TONE | string }) {
  return <Badge tone={PRIORITY_TONE[value as keyof typeof PRIORITY_TONE] ?? "neutral"}>{formatStatus(value)}</Badge>;
}

export function ErrorState({ message = "Couldn't load this section." }: { message?: string }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl px-4 py-5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
      <span>{message}</span>
      <RetryButton />
    </div>
  );
}

export function EmptyBlock({ title, hint, icon = "box", action }: { title: string; hint?: string; icon?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <Icon name={icon} size={20} />
      </div>
      <p className="text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      {hint && <p className="text-[12.5px] mt-1 max-w-sm" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string; align?: "right" };

export function DataTable<T>({ columns, rows, empty, rowKey }: { columns: Column<T>[]; rows: T[]; empty?: ReactNode; rowKey: (row: T) => string }) {
  if (rows.length === 0) return <>{empty ?? <EmptyBlock title="Nothing to show" hint="No records match the current view." />}</>;
  return (
    <div className="overflow-x-auto">
      <table className="adm-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className} style={c.align === "right" ? { textAlign: "right" } : undefined}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Builds an href preserving current query params, overriding the given ones. */
export function withParams(base: string, sp: SP, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") q.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ base, sp, page, total, size = PAGE_SIZE }: { base: string; sp: SP; page: number; total: number; size?: number }) {
  const pages = totalPages(total, size);
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const btn = "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border";
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-[12.5px]" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
      <span>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total.toLocaleString("en-IN")}`}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={withParams(base, sp, { page: String(page - 1) })} className={btn} style={{ borderColor: "var(--border)" }}>Previous</Link> : <span className={`${btn} opacity-40`} style={{ borderColor: "var(--border)" }}>Previous</span>}
        <span>Page {page} of {pages}</span>
        {page < pages ? <Link href={withParams(base, sp, { page: String(page + 1) })} className={btn} style={{ borderColor: "var(--border)" }}>Next</Link> : <span className={`${btn} opacity-40`} style={{ borderColor: "var(--border)" }}>Next</span>}
      </div>
    </div>
  );
}

export type FilterField =
  | { name: string; type: "search"; placeholder?: string }
  | { name: string; type: "select"; label: string; options: { value: string; label: string }[] };

/** Plain GET form — filters live in the URL, so pages stay server-rendered and shareable. */
export function FilterBar({ fields, sp, reset }: { fields: FilterField[]; sp: SP; reset: string }) {
  const val = (n: string) => (Array.isArray(sp[n]) ? sp[n]![0] : (sp[n] as string | undefined)) ?? "";
  const input = "rounded-lg px-3 py-2 text-[13px] outline-none";
  const style = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;
  return (
    <form method="get" className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      {fields.map((f) =>
        f.type === "search" ? (
          <input key={f.name} name={f.name} defaultValue={val(f.name)} placeholder={f.placeholder ?? "Search…"} className={`${input} min-w-[200px] flex-1`} style={style} />
        ) : (
          <select key={f.name} name={f.name} defaultValue={val(f.name)} className={input} style={style} aria-label={f.label}>
            <option value="">{f.label}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      )}
      <button type="submit" className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>Apply</button>
      <Link href={reset} className="text-[12.5px] font-semibold px-2" style={{ color: "var(--text-secondary)" }}>Reset</Link>
    </form>
  );
}

export function StatTile({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="adm-card p-4">
      <div className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="text-[24px] font-bold mt-1" style={{ color: "var(--text-primary)" }}>{value}</div>
      {hint && <div className="text-[11.5px] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

export function TrendBadge({ pct, direction, goodWhen = "up", suffix }: { pct: number | null; direction: "up" | "down" | "flat"; goodWhen?: "up" | "down"; suffix?: string }) {
  if (direction === "flat") return <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>— 0%{suffix ? ` ${suffix}` : ""}</span>;
  const good = direction === goodWhen;
  const color = good ? "var(--success)" : "var(--danger)";
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold" style={{ color }}>
      <Icon name={direction === "up" ? "arrowUp" : "arrowDown"} size={13} strokeWidth={2.4} />
      {pct === null ? "New" : `${Math.abs(pct)}%`}
      {suffix && <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{suffix}</span>}
    </span>
  );
}
