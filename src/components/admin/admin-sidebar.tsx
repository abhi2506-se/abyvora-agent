"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AbyvoraLogo } from "@/components/brand/abyvora-logo";
import { Icon } from "@/components/admin/icons";
import { ADMIN_DASHBOARD_ITEM, ADMIN_NAV, allNavHrefs, type BadgeKey } from "@/lib/admin/nav";

/** Longest-prefix match so /admin/support/escalated highlights "Escalated", not "All Complaints". */
export function activeHref(pathname: string): string {
  if (pathname === "/admin") return "/admin";
  return allNavHrefs()
    .filter((h) => h !== "/admin" && (pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

function NavBody({ counts, onNavigate, collapsed = false }: { counts: Record<BadgeKey, number>; userName?: string; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname);
  return (
    <>
      <nav className="flex-1 overflow-y-auto pb-3" aria-label="Platform Owner navigation">
        <div className="pt-2">
          <Link href={ADMIN_DASHBOARD_ITEM.href} onClick={onNavigate} title={collapsed ? "Dashboard" : undefined} className={`adm-link ${active === "/admin" ? "active" : ""}`} aria-current={active === "/admin" ? "page" : undefined}>
            <Icon name="home" /> {!collapsed && <span>Dashboard</span>}
          </Link>
        </div>
        {ADMIN_NAV.map((section) => (
          <div key={section.title}>
            {collapsed ? <div className="mx-4 my-2" style={{ borderTop: "1px solid var(--border)" }} /> : <div className="adm-section">{section.title}</div>}
            {section.items.map((item) => {
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} className={`adm-link ${active === item.href ? "active" : ""}`} aria-current={active === item.href ? "page" : undefined} style={collapsed ? { justifyContent: "center", position: "relative" } : undefined}>
                  <Icon name={item.icon} size={16} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {count > 0 && (collapsed ? <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full" style={{ background: "var(--danger)" }} aria-label={`${count} pending`} /> : <span className="adm-badge" aria-label={`${count} pending`}>{count > 99 ? "99+" : count}</span>)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`m-3 p-3 rounded-xl flex items-center gap-3 ${collapsed ? "justify-center" : ""}`} style={{ background: "var(--adm-sidebar-hover)" }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#1c2440", color: "#f6b73c" }}><Icon name="crown" size={16} /></div>
        {!collapsed && <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-bold truncate" style={{ color: "var(--text-primary)" }}>Super Admin</div>
          <div className="text-[11px]" style={{ color: "var(--adm-sidebar-muted)" }}>ABYVORA Global</div>
        </div>}
      </div>
    </>
  );
}

function Brand({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div className={`px-4 py-4 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <AbyvoraLogo variant="mark" height={30} />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[16px] font-extrabold tracking-wide" style={{ color: "var(--text-primary)" }}>ABYVORA</div>
            <div className="text-[10.5px]" style={{ color: "var(--adm-sidebar-muted)" }}>Build. Manage. Scale.</div>
          </div>
        )}
      </div>
      {onToggle && (
        <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}
          className="w-7 h-7 rounded-lg inline-flex items-center justify-center" style={{ color: "var(--adm-sidebar-muted)" }}>
          <span style={{ display: "inline-flex", transform: collapsed ? "rotate(180deg)" : undefined }}><Icon name="chevronLeft" size={18} /></span>
        </button>
      )}
    </div>
  );
}

const COLLAPSE_KEY = "abyvora-admin-sidebar";

export function AdminSidebar(props: { counts: Record<BadgeKey, number>; userName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  // Restore the saved preference after mount (timer callback, not a synchronous effect setState).
  useEffect(() => {
    const t = setTimeout(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage unavailable */ } }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); } catch { /* ignore */ } return n; });
  return (
    <aside className="adm-sidebar hidden lg:flex flex-col shrink-0 sticky top-0 h-screen transition-[width] duration-200" style={{ width: collapsed ? 76 : 252 }}>
      <Brand collapsed={collapsed} onToggle={toggle} />
      <NavBody {...props} collapsed={collapsed} />
    </aside>
  );
}

export function AdminMobileNav(props: { counts: Record<BadgeKey, number>; userName: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation menu" className="w-9 h-9 inline-flex items-center justify-center rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
        <Icon name="menu" size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex abv-fade-in" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0" style={{ background: "rgba(9,12,28,0.55)" }} onClick={() => setOpen(false)} />
          <div className="adm-sidebar relative w-72 max-w-[85vw] h-full flex flex-col" style={{ boxShadow: "var(--shadow-lg)" }}>
            <div className="flex items-center justify-between pr-3"><Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" style={{ color: "var(--text-secondary)" }}><Icon name="x" size={18} /></button>
            </div>
            <NavBody {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
