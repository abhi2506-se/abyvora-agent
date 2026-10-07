"use client";

import { ActionForm, CredentialResult, FormDialogButton, type FormField } from "@/components/admin/action-form";

/**
 * Concrete forms for every Platform Owner mutation, each posting to a real,
 * server-guarded API. Shared by the Quick Actions grid and by the pages that
 * need the same action inline (so there is exactly one implementation).
 */
const num = (v: string | boolean) => Number(v);

export const ORG_FIELDS: FormField[] = [
  { name: "name", label: "Organization name", required: true },
  { name: "legalName", label: "Legal name" },
  { name: "industry", label: "Industry" },
  { name: "website", label: "Website", placeholder: "https://" },
  { name: "contactEmail", label: "Contact email", type: "email", required: true },
  { name: "contactPhone", label: "Contact phone" },
  { name: "planId", label: "Plan", type: "select", optionsKind: "plans" },
  { name: "ownerName", label: "Owner name", required: true },
  { name: "ownerEmail", label: "Owner email", type: "email", required: true, hint: "Becomes the organization's ORG_OWNER login." },
];

export function CreateOrganizationForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm endpoint="/api/admin/organizations" fields={ORG_FIELDS} submitLabel="Create organization" onDone={onDone}
      renderResult={(d) => { const l = d.ownerLogin as { email: string; temporaryPassword: string }; return <CredentialResult email={l.email} password={l.temporaryPassword} />; }} />
  );
}

export const USER_ROLES = ["ADMIN","AGENT","CLIENT","IT_SUPPORT","ORG_OWNER","ORG_ADMIN","HIGHER_MANAGER","MID_MANAGER","LOWER_MANAGER","HR","EMPLOYEE"].map((r) => ({ value: r, label: r.replace(/_/g, " ") }));

export function CreateUserForm({ onDone, organizationId }: { onDone?: () => void; organizationId?: string }) {
  const fields: FormField[] = [
    { name: "name", label: "Full name", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone" },
    { name: "role", label: "Role", type: "select", options: USER_ROLES, required: true },
    ...(organizationId ? [] : [{ name: "organizationId", label: "Organization", type: "select" as const, optionsKind: "orgs", hint: "Leave empty for ABYVORA-internal staff (Admin / IT Support)." }]),
    { name: "departmentId", label: "Department", type: "select", optionsKind: "departments", dependsOn: organizationId ? undefined : "organizationId" },
    { name: "managerId", label: "Manager", type: "select", optionsKind: "managers", dependsOn: organizationId ? undefined : "organizationId" },
  ];
  return (
    <ActionForm endpoint="/api/admin/users" fields={fields} submitLabel="Create user" onDone={onDone}
      transform={(v) => ({ ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "")), ...(organizationId ? { organizationId } : {}) })}
      renderResult={(d) => { const u = d.user as { email: string }; return <CredentialResult email={u.email} password={String(d.temporaryPassword)} />; }} />
  );
}

export function AssignTicketForm({ onDone }: { onDone?: () => void }) {
  const fields: FormField[] = [
    { name: "ticketId", label: "Ticket", type: "select", optionsKind: "tickets", required: true, hint: "Lists tickets in Admin Review. For a new ticket, open it and click “Start review” first." },
    { name: "assignToType", label: "Assign to", type: "select", required: true, options: [{ value: "AGENT", label: "Support agent" }, { value: "IT_SUPPORT", label: "IT specialist" }] },
    { name: "agentId", label: "Agent (if support agent)", type: "select", optionsKind: "agents" },
    { name: "itSupportUserId", label: "IT specialist (if IT)", type: "select", optionsKind: "it" },
    { name: "reason", label: "Note", type: "textarea" },
  ];
  return (
    <ActionForm endpoint={(v) => `/api/support/tickets/${v.ticketId}/assign`} fields={fields} submitLabel="Assign ticket" onDone={onDone}
      transform={(v) => ({ assignToType: v.assignToType, agentId: v.agentId || undefined, itSupportUserId: v.itSupportUserId || undefined, reason: v.reason || undefined })} />
  );
}

export function GenerateInvoiceForm({ onDone }: { onDone?: () => void }) {
  const fields: FormField[] = [
    { name: "projectId", label: "Project", type: "select", optionsKind: "projects", required: true },
    { name: "billingName", label: "Billing name", required: true },
    { name: "billingEmail", label: "Billing email", type: "email", required: true },
    { name: "description", label: "Line item description", required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true, defaultValue: "1" },
    { name: "unitPrice", label: "Unit price (INR)", type: "number", required: true },
    { name: "taxLabel", label: "Tax label", placeholder: "e.g. GST 18%", hint: "Tax is never guessed — enter the label and amount yourself." },
    { name: "taxAmount", label: "Tax amount (INR)", type: "number" },
  ];
  return (
    <ActionForm endpoint="/api/invoices" fields={fields} submitLabel="Generate invoice" onDone={onDone}
      transform={(v) => ({
        projectId: v.projectId, billingName: v.billingName, billingEmail: v.billingEmail,
        items: [{ description: v.description, quantity: num(v.quantity), unitPrice: num(v.unitPrice) }],
        ...(v.taxLabel ? { taxLabel: v.taxLabel } : {}), ...(v.taxAmount !== "" ? { taxAmount: num(v.taxAmount) } : {}),
      })} />
  );
}

export function CreateDepartmentForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm endpoint="/api/admin/departments" onDone={onDone} submitLabel="Create department"
      fields={[
        { name: "name", label: "Department name", required: true },
        { name: "organizationId", label: "Organization", type: "select", optionsKind: "orgs", hint: "Leave empty for an ABYVORA-internal department." },
      ]} />
  );
}

export function CreateTeamForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm endpoint="/api/admin/teams" onDone={onDone} submitLabel="Create team"
      fields={[
        { name: "name", label: "Team name", required: true },
        { name: "organizationId", label: "Organization", type: "select", optionsKind: "orgs", hint: "Empty = ABYVORA-internal." },
        { name: "departmentId", label: "Department", type: "select", optionsKind: "departments", dependsOn: "organizationId" },
      ]} />
  );
}

export function AddSupportAgentForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm endpoint="/api/admin/support-agents" onDone={onDone} submitLabel="Add support agent"
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone" },
        { name: "type", label: "Type", type: "select", required: true, options: [{ value: "AGENT", label: "Support agent" }, { value: "IT_SUPPORT", label: "IT specialist" }] },
        { name: "departmentId", label: "Department", type: "select", optionsKind: "departments" },
      ]}
      renderResult={(d) => { const u = d.user as { email: string }; return <CredentialResult email={u.email} password={String(d.temporaryPassword)} />; }} />
  );
}

export function PlanForm({ onDone, initial }: { onDone?: () => void; initial?: { id: string; name: string; slug: string; priceMonthly: number; maxUsers?: number; active: boolean } }) {
  const fields: FormField[] = [
    { name: "name", label: "Plan name", required: true, defaultValue: initial?.name },
    { name: "slug", label: "Slug", required: true, defaultValue: initial?.slug, hint: "lowercase letters, numbers, dashes" },
    { name: "priceMonthly", label: "Monthly price (INR)", type: "number", required: true, defaultValue: initial ? String(initial.priceMonthly) : undefined },
    { name: "priceYearly", label: "Yearly price (INR)", type: "number" },
    { name: "maxUsers", label: "Max users", type: "number", defaultValue: initial?.maxUsers !== undefined ? String(initial.maxUsers) : undefined, hint: "Enforced server-side when users are added." },
    { name: "aiEnabled", label: "AI features enabled", type: "checkbox" },
    { name: "active", label: "Active (selectable for new organizations)", type: "checkbox", defaultValue: initial?.active ?? true },
  ];
  return (
    <ActionForm endpoint={initial ? `/api/admin/plans/${initial.id}` : "/api/admin/plans"} method={initial ? "PATCH" : "POST"} fields={fields} onDone={onDone} submitLabel={initial ? "Save plan" : "Create plan"}
      transform={(v) => ({
        name: v.name, slug: v.slug, priceMonthly: num(v.priceMonthly), ...(v.priceYearly !== "" ? { priceYearly: num(v.priceYearly) } : {}),
        features: { ...(v.maxUsers !== "" ? { maxUsers: num(v.maxUsers) } : {}), aiEnabled: !!v.aiEnabled }, active: !!v.active,
      })} />
  );
}

const BTN = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold";
const PRIMARY = { background: "var(--brand)", color: "var(--brand-contrast)" } as const;

export function NewOrganizationButton() {
  return <FormDialogButton label="+ New organization" title="Create organization" className={BTN} style={PRIMARY}>{(c) => <CreateOrganizationForm onDone={c} />}</FormDialogButton>;
}
export function NewUserButton({ organizationId }: { organizationId?: string }) {
  return <FormDialogButton label="+ New user" title="Create user" className={BTN} style={PRIMARY}>{(c) => <CreateUserForm onDone={c} organizationId={organizationId} />}</FormDialogButton>;
}
export function NewDepartmentButton() {
  return <FormDialogButton label="+ New department" title="Create department" className={BTN} style={PRIMARY}>{(c) => <CreateDepartmentForm onDone={c} />}</FormDialogButton>;
}
export function NewTeamButton() {
  return <FormDialogButton label="+ New team" title="Create team" className={BTN} style={PRIMARY}>{(c) => <CreateTeamForm onDone={c} />}</FormDialogButton>;
}
export function NewInvoiceButton() {
  return <FormDialogButton label="+ Generate invoice" title="Generate invoice" className={BTN} style={PRIMARY}>{(c) => <GenerateInvoiceForm onDone={c} />}</FormDialogButton>;
}
export function NewPlanButton() {
  return <FormDialogButton label="+ New plan" title="Create plan" className={BTN} style={PRIMARY}>{(c) => <PlanForm onDone={c} />}</FormDialogButton>;
}
export function AssignTicketButton() {
  return <FormDialogButton label="Assign ticket" title="Assign ticket" className={BTN} style={PRIMARY}>{(c) => <AssignTicketForm onDone={c} />}</FormDialogButton>;
}
export function AddAgentButton() {
  return <FormDialogButton label="+ Add support agent" title="Add support agent" className={BTN} style={PRIMARY}>{(c) => <AddSupportAgentForm onDone={c} />}</FormDialogButton>;
}
export function EditPlanButton({ plan }: { plan: { id: string; name: string; slug: string; priceMonthly: number; maxUsers?: number; active: boolean } }) {
  return <FormDialogButton label="Edit" title={`Edit ${plan.name}`} className="adm-link-text" >{(c) => <PlanForm onDone={c} initial={plan} />}</FormDialogButton>;
}
