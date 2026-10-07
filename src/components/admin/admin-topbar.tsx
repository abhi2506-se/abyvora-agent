import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GlobalSearch } from "@/components/admin/global-search";
import { NotificationCenter } from "@/components/admin/notification-center";
import { AdminMobileNav } from "@/components/admin/admin-sidebar";
import { AppsMenu, LanguageMenu } from "@/components/admin/topbar-menus";
import { Icon } from "@/components/admin/icons";
import { initials } from "@/lib/admin/format";
import type { BadgeKey } from "@/lib/admin/nav";

export function AdminTopbar({ userName, image, counts, onSignOut }: { userName: string; image?: string | null; counts: Record<BadgeKey, number>; onSignOut: () => Promise<void> }) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 md:px-7 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <AdminMobileNav counts={counts} userName={userName} />
      <GlobalSearch />
      <div className="flex-1" />
      <NotificationCenter />
      <ThemeToggle />
      <LanguageMenu />
      <AppsMenu />
      <details className="relative">
        <summary className="list-none cursor-pointer flex items-center gap-2.5 pl-1">
          {image
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied avatar host; next/image would need remotePatterns
            ? <img src={image} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
            : <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{initials(userName)}</span>}
          <span className="hidden md:block leading-tight text-left">
            <span className="block text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{userName}</span>
            <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>Super Admin</span>
          </span>
          <Icon name="chevronDown" size={14} />
        </summary>
        <div className="absolute right-0 mt-2 w-52 rounded-xl py-1.5 z-50 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
          {[["Profile", "/admin/profile"], ["Security", "/admin/profile/security"], ["MFA", "/admin/profile/mfa"], ["Sessions", "/admin/profile/sessions"]].map(([l, h]) => (
            <Link key={h} href={h} className="block px-4 py-2 hover:opacity-70" style={{ color: "var(--text-primary)" }}>{l}</Link>
          ))}
          <form action={onSignOut} style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
            <button type="submit" className="w-full text-left px-4 py-2 font-semibold" style={{ color: "var(--danger)" }}>Logout</button>
          </form>
        </div>
      </details>
    </header>
  );
}
