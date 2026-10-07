import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export default async function ProfileMfaPage() {
  const s = await pageGuard();
  const u = await prisma.user.findUnique({ where: { id: s.user.id }, select: { mfaEnabled: true } });
  return (
    <>
      <PageHeader title="Multi-factor authentication" />
      <Panel className="max-w-xl">
        <p className="text-[13.5px] flex items-center gap-2">Authenticator app: <Badge tone={u?.mfaEnabled ? "success" : "danger"}>{u?.mfaEnabled ? "Enabled" : "Not enabled"}</Badge></p>
        <p className="text-[13px] mt-3" style={{ color: "var(--text-secondary)" }}>MFA is mandatory for the Platform Owner and is re-verified on every sign-in; the console is inaccessible until a code is accepted for the current session. Resetting MFA is an out-of-band operation (<code>npm run create-owner</code> / database access) so that a compromised session can’t disable it.</p>
        <p className="mt-3 text-[13px]"><Link href="/admin/mfa" className="adm-link-text">Re-verify this session →</Link></p>
      </Panel>
    </>
  );
}
