"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { relativeTime } from "@/lib/admin/format";

type Stored = { id: string; type: string; title: string; body: string | null; read: boolean; createdAt: string; metadata?: { entityType?: string; entityId?: string } | null };
type Live = { id: string; title: string; body: string; href: string; severity: "info" | "warning" | "critical"; count: number };

const SEV = { info: "var(--brand)", warning: "var(--warning)", critical: "var(--danger)" } as const;

function hrefFor(n: Stored): string {
  const m = n.metadata;
  if (m?.entityType === "SupportTicket" && m.entityId) return `/admin/support/${m.entityId}`;
  if (m?.entityType === "Organization" && m.entityId) return `/admin/organizations/${m.entityId}`;
  return "/admin";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ stored: Stored[]; live: Live[]; unreadCount: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    load();
  }
  async function markOne(id: string) {
    await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    load();
  }

  const unread = data?.unreadCount ?? 0;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}
        className="relative w-9 h-9 inline-flex items-center justify-center rounded-full" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: "var(--danger)" }}>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] rounded-xl overflow-hidden z-50" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
            {(data?.stored.some((n) => !n.read)) && <button type="button" onClick={markAll} className="adm-link-text">Mark all read</button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {failed && <p className="px-4 py-4 text-[12.5px]" style={{ color: "var(--danger)" }}>Couldn’t load notifications. <button type="button" className="adm-link-text" onClick={load}>Retry</button></p>}
            {!failed && !data && <p className="px-4 py-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Loading…</p>}
            {data && data.live.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Needs attention</div>
                {data.live.map((a) => (
                  <Link key={a.id} href={a.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-2.5 hover:opacity-80">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: SEV[a.severity] }} />
                    <span className="min-w-0"><span className="block text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{a.title}</span><span className="block text-[12px]" style={{ color: "var(--text-secondary)" }}>{a.body}</span></span>
                  </Link>
                ))}
              </div>
            )}
            {data && data.stored.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent</div>
                {data.stored.map((n) => (
                  <Link key={n.id} href={hrefFor(n)} onClick={() => { setOpen(false); if (!n.read) markOne(n.id); }} className="flex gap-3 px-4 py-2.5" style={{ background: n.read ? "transparent" : "var(--accent-soft)" }}>
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: n.read ? "var(--border)" : "var(--brand)" }} />
                    <span className="min-w-0"><span className="block text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</span>
                      {n.body && <span className="block text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>{n.body}</span>}
                      <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{relativeTime(n.createdAt)}</span></span>
                  </Link>
                ))}
              </div>
            )}
            {data && data.live.length === 0 && data.stored.length === 0 && <p className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>You’re all caught up.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
