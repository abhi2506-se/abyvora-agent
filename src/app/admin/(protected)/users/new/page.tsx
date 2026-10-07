import { pageGuard } from "@/lib/admin/guard";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CreateUserForm } from "@/components/admin/forms";

export default async function NewUserPage() {
  await pageGuard();
  return (
    <>
      <PageHeader title="Create User" description="Creates the account with a one-time temporary password. Plan user limits are enforced." />
      <Panel className="max-w-xl"><CreateUserForm /></Panel>
    </>
  );
}
