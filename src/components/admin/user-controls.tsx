"use client";

import { ActionForm, FormDialogButton } from "@/components/admin/action-form";
import { USER_ROLES } from "@/components/admin/forms";

const BTN = "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold";

export function UserControls({ userId, role, status, organizationId }: { userId: string; role: string; status: string; organizationId: string | null }) {
  const isOrgUser = !!organizationId;
  return (
    <div className="flex flex-wrap gap-2">
      <FormDialogButton label="Change role" title="Change role" className={BTN} style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>
        {(c) => <ActionForm endpoint={`/api/admin/users/${userId}`} method="PATCH" submitLabel="Update role" onDone={c}
          fields={[{ name: "role", label: "New role", type: "select", options: USER_ROLES.filter((r) => !isOrgUser || !["ADMIN", "IT_SUPPORT"].includes(r.value)), required: true, defaultValue: role }]} />}
      </FormDialogButton>
      <FormDialogButton label={status === "DISABLED" ? "Enable account" : "Disable account"} title={status === "DISABLED" ? "Enable account" : "Disable account"}
        className={BTN} style={status === "DISABLED" ? { border: "1px solid var(--border)", color: "var(--text-primary)" } : { background: "var(--danger-soft)", color: "var(--danger)" }}>
        {(c) => <ActionForm endpoint={`/api/admin/users/${userId}`} method="PATCH" submitLabel={status === "DISABLED" ? "Enable" : "Disable"} onDone={c} transform={() => ({ status: status === "DISABLED" ? "ACTIVE" : "DISABLED" })} fields={[]} />}
      </FormDialogButton>
    </div>
  );
}
