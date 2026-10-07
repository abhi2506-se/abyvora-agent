import { prisma } from "@/lib/prisma";
import { cleanQuery } from "@/lib/admin/query";

export type SearchHit = { id: string; type: string; title: string; subtitle?: string; href: string };

/** Static report catalogue searched alongside DB entities. */
export const REPORT_CATALOG = [
  { slug: "business", label: "Business Reports" },
  { slug: "user-activity", label: "User Activity Reports" },
  { slug: "financial", label: "Financial Reports" },
  { slug: "organization", label: "Organization Reports" },
  { slug: "revenue", label: "Revenue Reports" },
  { slug: "support", label: "Support Reports" },
  { slug: "custom", label: "Custom Reports" },
];

/**
 * Platform-wide search. Caller MUST have passed requirePlatformOwner() — the
 * route does. Each entity is capped at 5 rows and queried in parallel.
 */
export async function globalSearch(rawQuery: string): Promise<SearchHit[]> {
  const q = cleanQuery(rawQuery);
  if (!q) return [];
  const has = { contains: q, mode: "insensitive" as const };

  const [orgs, users, tickets, payments, invoices, subs, projects] = await Promise.all([
    prisma.organization.findMany({
      where: { OR: [{ name: has }, { slug: has }, { contactEmail: has }] },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: has }, { email: has }] },
      take: 5,
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.supportTicket.findMany({
      where: { OR: [{ ticketNumber: has }, { title: has }] },
      take: 5,
      select: { id: true, ticketNumber: true, title: true },
    }),
    prisma.payment.findMany({
      where: { OR: [{ providerPaymentId: has }, { providerOrderId: has }, { receipt: has }] },
      take: 5,
      select: { id: true, providerPaymentId: true, receipt: true, amount: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { OR: [{ invoiceNumber: has }, { billingName: has }] },
      take: 5,
      select: { id: true, invoiceNumber: true, billingName: true },
    }),
    prisma.organizationSubscription.findMany({
      where: { organization: { name: has } },
      take: 5,
      select: { id: true, organizationId: true, status: true, organization: { select: { name: true } }, plan: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { name: has },
      take: 5,
      select: { id: true, name: true, status: true, organizationId: true },
    }),
  ]);

  const hits: SearchHit[] = [];
  for (const o of orgs) hits.push({ id: o.id, type: "Organization", title: o.name, subtitle: o.status, href: `/admin/organizations/${o.id}` });
  for (const u of users) hits.push({ id: u.id, type: "User", title: u.name, subtitle: `${u.email} · ${u.role}`, href: `/admin/users/${u.id}` });
  for (const t of tickets) hits.push({ id: t.id, type: "Ticket", title: `${t.ticketNumber} — ${t.title}`, href: `/admin/support/${t.id}` });
  for (const p of payments) hits.push({ id: p.id, type: "Payment", title: p.providerPaymentId ?? p.receipt ?? p.id, subtitle: `${p.status} · ₹${Number(p.amount)}`, href: `/admin/revenue/transactions?q=${encodeURIComponent(p.providerPaymentId ?? p.receipt ?? "")}` });
  for (const i of invoices) hits.push({ id: i.id, type: "Invoice", title: i.invoiceNumber, subtitle: i.billingName, href: `/admin/revenue/invoices?q=${encodeURIComponent(i.invoiceNumber)}` });
  for (const s of subs) hits.push({ id: s.id, type: "Subscription", title: s.organization.name, subtitle: `${s.plan.name} · ${s.status}`, href: `/admin/organizations/${s.organizationId}?tab=subscription` });
  for (const p of projects) hits.push({ id: p.id, type: "Project", title: p.name, subtitle: p.status, href: p.organizationId ? `/admin/organizations/${p.organizationId}?tab=projects` : `/admin/organizations` });

  const ql = q.toLowerCase();
  for (const r of REPORT_CATALOG) {
    if (r.label.toLowerCase().includes(ql) || r.slug.includes(ql)) {
      hits.push({ id: r.slug, type: "Report", title: r.label, href: `/admin/reports/${r.slug}` });
    }
  }
  return hits;
}
