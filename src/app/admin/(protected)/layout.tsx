import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthzError, requirePlatformOwner } from "@/lib/authz";
import { signOut } from "@/lib/auth";
import { getNavCounts } from "@/lib/admin/counts";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export const metadata: Metadata = { title: "ABYVORA · Platform Owner" };

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  // Hard server-side gate (Phase 2, preserved unchanged): role + MFA verified
  // THIS session. middleware.ts does the same at the edge; this is the check a
  // direct RSC / API request can't bypass.
  let session;
  try {
    session = await requirePlatformOwner();
  } catch (err) {
    if (err instanceof AuthzError && err.status === 401) redirect("/admin/mfa");
    redirect("/dashboard");
  }

  // Sidebar badges are best-effort UI: a failed count query must never take
  // down the whole console, so degrade to zeros instead of throwing.
  const counts = await getNavCounts().catch(() => ({ orgRequests: 0, orgApprovals: 0, complaints: 0, unassigned: 0, auditAlerts: 0 }));

  const avatar = await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } }).catch(() => null);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="admin-app flex min-h-screen">
      <AdminSidebar counts={counts} userName={session.user.name} />
      <div className="flex flex-col flex-1 min-w-0">
        <AdminTopbar userName={session.user.name} image={avatar?.image ?? null} counts={counts} onSignOut={handleSignOut} />
        <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 md:px-7 py-6">{children}</main>
        <footer className="px-7 py-4 text-[12px] flex flex-wrap justify-between gap-2" style={{ color: "var(--text-muted)" }}>
          <span>© {new Date().getFullYear()} ABYVORA. All rights reserved.</span>
          <span className="flex gap-4"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
        </footer>
      </div>
    </div>
  );
}
