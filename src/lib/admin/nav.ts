/**
 * Single source of truth for the Platform Owner sidebar. Every `href` here
 * has a real page under src/app/admin — a test (admin-nav.test.ts) walks
 * this list against the filesystem so a dead link fails CI.
 */
export type BadgeKey = "orgRequests" | "orgApprovals" | "complaints" | "unassigned" | "auditAlerts";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: BadgeKey;
  /** Items shown with a chevron in the reference (they have sub-pages). */
  expandable?: boolean;
};

export type AdminNavSection = { title: string; items: AdminNavItem[] };

export const ADMIN_DASHBOARD_ITEM: AdminNavItem = { label: "Dashboard", href: "/admin", icon: "home" };

export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: "Organizations",
    items: [
      { label: "All Organizations", href: "/admin/organizations", icon: "building" },
      { label: "Organization Requests", href: "/admin/organizations/requests", icon: "inbox", badge: "orgRequests" },
      { label: "Organization Approvals", href: "/admin/organizations/approvals", icon: "check", badge: "orgApprovals" },
      { label: "Organization Directory", href: "/admin/organizations/directory", icon: "book" },
      { label: "Organization Hierarchy", href: "/admin/organizations/hierarchy", icon: "tree" },
      { label: "Organization Activity", href: "/admin/organizations/activity", icon: "pulse" },
      { label: "Subscription Plans", href: "/admin/organizations/plans", icon: "crown" },
      { label: "Organization Analytics", href: "/admin/organizations/analytics", icon: "chart" },
      { label: "Organization Settings", href: "/admin/organizations/settings", icon: "gear" },
    ],
  },
  {
    title: "User Management",
    items: [
      { label: "Create User", href: "/admin/users/new", icon: "userPlus" },
      { label: "All Users", href: "/admin/users", icon: "users" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: "shield" },
      { label: "Departments", href: "/admin/departments", icon: "building" },
      { label: "Teams", href: "/admin/teams", icon: "users" },
      { label: "Employee Directory", href: "/admin/employees", icon: "book" },
      { label: "Organization Chart", href: "/admin/org-chart", icon: "tree" },
    ],
  },
  {
    title: "Support & Complaints",
    items: [
      { label: "All Complaints", href: "/admin/support", icon: "ticket", badge: "complaints" },
      { label: "Unassigned", href: "/admin/support/unassigned", icon: "inbox", badge: "unassigned" },
      { label: "My Complaints", href: "/admin/support/mine", icon: "user" },
      { label: "Agent Queue", href: "/admin/support/agents", icon: "users" },
      { label: "Escalated", href: "/admin/support/escalated", icon: "alert" },
      { label: "SLA Monitor", href: "/admin/support/sla", icon: "clock" },
      { label: "Resolved Tickets", href: "/admin/support/resolved", icon: "check" },
      { label: "Support Analytics", href: "/admin/support/analytics", icon: "chart" },
      { label: "Knowledge Base", href: "/admin/support/knowledge-base", icon: "book" },
    ],
  },
  {
    title: "Revenue & Payments",
    items: [
      { label: "Payment Dashboard", href: "/admin/revenue", icon: "wallet" },
      { label: "Transactions", href: "/admin/revenue/transactions", icon: "card" },
      { label: "Invoices", href: "/admin/revenue/invoices", icon: "file" },
      { label: "Subscriptions", href: "/admin/revenue/subscriptions", icon: "crown" },
      { label: "Refunds", href: "/admin/revenue/refunds", icon: "undo" },
      { label: "Payment Gateways", href: "/admin/revenue/gateways", icon: "plug" },
      { label: "Financial Reports", href: "/admin/revenue/reports", icon: "chart" },
    ],
  },
  {
    title: "Products & Services",
    items: [
      { label: "Services Management", href: "/admin/products/services", icon: "box" },
      { label: "Plans & Pricing", href: "/admin/products/pricing", icon: "tag" },
      { label: "Feature Control", href: "/admin/products/features", icon: "toggle" },
      { label: "Integrations", href: "/admin/products/integrations", icon: "plug" },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [
      { label: "Business Reports", href: "/admin/reports/business", icon: "chart" },
      { label: "User Activity Reports", href: "/admin/reports/user-activity", icon: "users" },
      { label: "Financial Reports", href: "/admin/reports/financial", icon: "wallet" },
      { label: "Custom Reports", href: "/admin/reports/custom", icon: "sliders" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "System Settings", href: "/admin/system/settings", icon: "gear" },
      { label: "Audit Logs", href: "/admin/system/audit-logs", icon: "file", badge: "auditAlerts" },
      { label: "Security & Compliance", href: "/admin/system/security", icon: "shield" },
      { label: "API / Integrations", href: "/admin/system/api", icon: "plug" },
      { label: "System Health", href: "/admin/system/health", icon: "pulse" },
    ],
  },
  {
    title: "Profile",
    items: [
      { label: "Profile", href: "/admin/profile", icon: "user" },
      { label: "Security", href: "/admin/profile/security", icon: "lock" },
      { label: "MFA", href: "/admin/profile/mfa", icon: "shield" },
      { label: "Sessions", href: "/admin/profile/sessions", icon: "clock" },
    ],
  },
];

/** Extra routes that are not in the sidebar but must exist (details / report types). */
export const ADMIN_EXTRA_ROUTES = [
  "/admin/reports/organization",
  "/admin/reports/revenue",
  "/admin/reports/support",
];

export function allNavHrefs(): string[] {
  return [ADMIN_DASHBOARD_ITEM.href, ...ADMIN_NAV.flatMap((s) => s.items.map((i) => i.href))];
}
