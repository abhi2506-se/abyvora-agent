"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open, close]);
  return ref;
}

const pop = { background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", color: "var(--text-primary)" } as const;

/** The console is English-only today; the menu says so rather than faking other languages. */
export function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Language" className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>
        EN <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl py-1.5 z-50 text-[13px]" style={pop} role="menu">
          <div className="px-4 py-2 flex items-center justify-between font-semibold" role="menuitemradio" aria-checked="true">English <span style={{ color: "var(--success)" }}>✓</span></div>
          <p className="px-4 py-2 text-[11.5px]" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>Other languages aren’t available yet — the console is English-only.</p>
        </div>
      )}
    </div>
  );
}

const APPS = [
  { label: "Organizations", href: "/admin/organizations", icon: "building" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Support", href: "/admin/support", icon: "ticket" },
  { label: "Revenue", href: "/admin/revenue", icon: "wallet" },
  { label: "Reports", href: "/admin/reports/business", icon: "chart" },
  { label: "Plans", href: "/admin/products/pricing", icon: "crown" },
  { label: "Audit logs", href: "/admin/system/audit-logs", icon: "file" },
  { label: "Health", href: "/admin/system/health", icon: "pulse" },
  { label: "Settings", href: "/admin/system/settings", icon: "gear" },
];

/** App-launcher grid (the dotted-grid icon): jump straight to any console area. */
export function AppsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Console shortcuts" className="w-9 h-9 inline-flex items-center justify-center rounded-lg" style={{ color: "var(--text-secondary)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{[5, 12, 19].flatMap((x) => [5, 12, 19].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />))}</svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl p-3 z-50 grid grid-cols-3 gap-2" style={pop}>
          {APPS.map((a) => (
            <Link key={a.href} href={a.href} onClick={() => setOpen(false)} className="flex flex-col items-center gap-1.5 rounded-lg py-3 text-[11.5px] font-medium text-center hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--brand)" }}><Icon name={a.icon} size={20} /></span>{a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
