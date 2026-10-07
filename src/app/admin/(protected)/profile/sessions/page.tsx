import { pageGuard } from "@/lib/admin/guard";
import { PageHeader, Panel } from "@/components/admin/ui";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function ProfileSessionsPage() {
  const s = await pageGuard();
  async function out() { "use server"; await signOut({ redirectTo: "/login" }); }
  return (
    <>
      <PageHeader title="Sessions" />
      <Panel className="max-w-xl">
        <dl className="text-[13.5px] space-y-2.5">
          <div><dt className="text-[11.5px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>This session</dt><dd>{s.user.email} · MFA verified</dd></div>
          {s.expires && <div><dt className="text-[11.5px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Expires</dt><dd>{new Date(s.expires).toLocaleString("en-IN")}</dd></div>}
        </dl>
        <p className="text-[12.5px] mt-4" style={{ color: "var(--text-secondary)" }}>Sessions are stateless signed tokens, so other devices can’t be listed or remotely revoked individually. Signing out ends this browser’s session.</p>
        <form action={out} className="mt-4"><button className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>Sign out</button></form>
      </Panel>
    </>
  );
}
