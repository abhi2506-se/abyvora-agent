"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/admin/icons";
import { RANGE_PRESETS } from "@/lib/admin/range";

/** URL-driven date range: every dashboard section re-renders server-side from ?range / ?from / ?to. */
export function RangePicker({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("range") ?? "this_month";
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function go(patch: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
        <Icon name="calendar" size={15} />
        <select aria-label="Date range" value={current} onChange={(e) => go({ range: e.target.value, ...(e.target.value === "custom" ? {} : { from: null, to: null }) })} className="bg-transparent outline-none font-medium cursor-pointer">
          {RANGE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span className="hidden md:inline" style={{ color: "var(--text-muted)" }}>· {label}</span>
      </div>
      {current === "custom" && (
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" style={{ padding: "6px 8px" }} aria-label="From date" />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" style={{ padding: "6px 8px" }} aria-label="To date" />
          <button type="button" disabled={!from || !to} onClick={() => go({ range: "custom", from, to })} className="px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>Apply</button>
        </div>
      )}
    </div>
  );
}

/** Small client select that writes one URL param (e.g. grouping, top-orgs sort, plan scope). */
export function ParamSelect({ param, options, fallback, label }: { param: string; options: { value: string; label: string }[]; fallback: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select aria-label={label} value={sp.get(param) ?? fallback}
      onChange={(e) => { const q = new URLSearchParams(sp.toString()); q.set(param, e.target.value); router.push(`${pathname}?${q.toString()}`, { scroll: false }); }}
      className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium outline-none cursor-pointer" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
