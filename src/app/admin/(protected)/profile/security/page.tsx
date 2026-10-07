import { pageGuard } from "@/lib/admin/guard";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";

export default async function ProfileSecurityPage() {
  await pageGuard();
  return (
    <>
      <PageHeader title="Security" description="Change your password. Your MFA stays enabled." />
      <Panel className="max-w-md">
        <ActionForm endpoint="/api/admin/profile/password" submitLabel="Update password"
          fields={[{ name: "currentPassword", label: "Current password", type: "password", required: true }, { name: "newPassword", label: "New password (min 10 characters, letters + numbers)", type: "password", required: true }]} />
      </Panel>
    </>
  );
}
