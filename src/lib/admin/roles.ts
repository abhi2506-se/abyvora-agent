import type { Role } from "@prisma/client";

/** Descriptive permission model. Authorization itself is enforced in lib/authz.ts + per-route checks; this is the human-readable map shown on the Roles page. */
export const ROLE_INFO: Record<Role, { label: string; scope: "Platform" | "ABYVORA internal" | "Organization"; summary: string; can: string[] }> = {
  PLATFORM_OWNER: { label: "Platform Owner", scope: "Platform", summary: "Cross-tenant super admin. MFA required every session.", can: ["See and manage all organizations", "Approve / suspend / terminate organizations", "Manage plans, pricing, subscriptions", "Platform audit logs & system health", "Oversee all support tickets"] },
  ADMIN: { label: "ABYVORA Admin", scope: "ABYVORA internal", summary: "ABYVORA's own operations administrator (single-tenant).", can: ["Manage leads, clients, projects", "Assign & forward support tickets", "Approve refunds, issue invoices", "Manage agents & commission rules"] },
  AGENT: { label: "Agent", scope: "ABYVORA internal", summary: "Sales/support agent working assigned records.", can: ["Work assigned leads, clients, projects", "Handle assigned support tickets", "Send proposals & emails"] },
  CLIENT: { label: "Client", scope: "ABYVORA internal", summary: "Customer portal user.", can: ["View own projects, invoices, payments", "Raise support tickets", "Request refunds"] },
  IT_SUPPORT: { label: "IT Support", scope: "ABYVORA internal", summary: "Technical support specialist.", can: ["Work forwarded / assigned IT tickets", "Resolve technical tickets"] },
  ORG_OWNER: { label: "Organization Owner", scope: "Organization", summary: "Owns a customer organization.", can: ["Manage own organization's users and settings", "View own organization's data only"] },
  ORG_ADMIN: { label: "Organization Admin", scope: "Organization", summary: "Administers a customer organization.", can: ["Manage users within own organization"] },
  HIGHER_MANAGER: { label: "Higher Manager", scope: "Organization", summary: "Senior manager inside an organization.", can: ["See reports across own organization's teams"] },
  MID_MANAGER: { label: "Mid Manager", scope: "Organization", summary: "Department-level manager.", can: ["Manage own department's work"] },
  LOWER_MANAGER: { label: "Lower Manager", scope: "Organization", summary: "Team-level manager.", can: ["Manage own team's work"] },
  HR: { label: "HR", scope: "Organization", summary: "People operations inside an organization.", can: ["Maintain employee records for own organization"] },
  EMPLOYEE: { label: "Employee", scope: "Organization", summary: "Regular staff member of an organization.", can: ["Access own assigned work"] },
};
