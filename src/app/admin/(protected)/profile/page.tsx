import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel, StatusPill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const s = await pageGuard();
  const u = await prisma.user.findUnique({ where: { id: s.user.id }, select: { name: true, email: true, phone: true, createdAt: true, lastLoginAt: true, status: true } });
  const rows: [string, React.ReactNode][] = [["Name", u?.name], ["Email", u?.email], ["Phone", u?.phone ?? "—"], ["Role", "Platform Owner (platform-wide)"], ["Status", u ? <StatusPill value={u.status} /> : "—"], ["Member since", u?.createdAt.toLocaleDateString("en-IN")], ["Last sign-in", u?.lastLoginAt?.toLocaleString("en-IN") ?? "—"]];
  return (
    <>
      <PageHeader title="Profile" />
      <Panel className="max-w-2xl"><dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[13.5px]">{rows.map(([k, v]) => <div key={k}><dt className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="mt-5 text-[13px]"><Link href="/admin/profile/security" className="adm-link-text">Change password →</Link></p></Panel>
    </>
  );
}
