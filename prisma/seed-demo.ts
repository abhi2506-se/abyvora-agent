/**
 * OPTIONAL demo data so the Platform Owner dashboard has something to show in a DEVELOPMENT database.
 *
 *   npm run seed:demo
 *
 * Safety: refuses to run when NODE_ENV=production, or when DATABASE_URL isn't a local database,
 * unless you explicitly set ALLOW_DEMO_SEED=1. Requires an existing Platform Owner (npm run create-owner).
 * Demo accounts get unusable random password hashes — they exist only to populate the data.
 * Never run this against a database with real customers.
 */
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const d = (daysAgo: number, h = 10) => new Date(Date.now() - daysAgo * 86400000 - h * 3600000 * 0);
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if ((process.env.NODE_ENV === "production" || !local) && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error("Refusing to seed demo data: NODE_ENV is production or DATABASE_URL is not local. Set ALLOW_DEMO_SEED=1 only if you are certain.");
    process.exit(1);
  }
  const owner = await prisma.user.findFirst({ where: { role: "PLATFORM_OWNER" } });
  if (!owner) { console.error("No Platform Owner found. Run `npm run create-owner` first."); process.exit(1); }
  if (await prisma.organization.count()) { console.error("Organizations already exist — demo seed only runs on an empty tenant table."); process.exit(1); }
  const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10); // unusable password: demo rows can't be logged into

  const plans = Object.fromEntries(await Promise.all([["Starter", 999, 5], ["Professional", 4999, 25], ["Business", 14999, 100], ["Enterprise", 49999, 1000]].map(async ([n, p, u]) => [n, await prisma.subscriptionPlan.create({ data: { name: n as string, slug: (n as string).toLowerCase(), priceMonthly: p as number, features: { maxUsers: u, aiEnabled: n !== "Starter" } } })])));

  const orgDefs: [string, string, string | null, string, number][] = [
    ["NextGen Careers", "nextgen", "Business", "ACTIVE", 150], ["Maple Immigration", "maple", "Professional", "ACTIVE", 120],
    ["Global Study Hub", "globalstudy", "Business", "ACTIVE", 90], ["Aspire Overseas", "aspire", "Professional", "ACTIVE", 60],
    ["EduFuture Consultants", "edufuture", "Starter", "GRACE_PERIOD", 30], ["Pending Co", "pendingco", null, "PENDING_REVIEW", 2],
  ];
  const orgs: Record<string, { id: string }> = {};
  for (const [name, slug, plan, status, age] of orgDefs) {
    const o = await prisma.organization.create({ data: { name, slug, status: status as never, industry: "Education", contactEmail: `hello@${slug}.example`, planId: plan ? plans[plan].id : null, createdAt: d(age) } });
    orgs[slug] = o;
    if (plan) await prisma.organizationSubscription.create({ data: { organizationId: o.id, planId: plans[plan].id, status: status === "GRACE_PERIOD" ? "GRACE_PERIOD" : "ACTIVE", currentPeriodStart: d(10), currentPeriodEnd: new Date(Date.now() + 20 * 86400000), createdAt: d(age) } });
    const ou = await prisma.user.create({ data: { email: `owner@${slug}.example`, name: `${name} Owner`, role: "ORG_OWNER", passwordHash: hash, organizationId: o.id, lastLoginAt: d(1), createdAt: d(age) } });
    await prisma.organization.update({ where: { id: o.id }, data: { ownerId: ou.id } });
    for (let i = 0; i < 3; i++) await prisma.user.create({ data: { email: `emp${i}@${slug}.example`, name: `${name} Emp ${i}`, role: i === 0 ? "MID_MANAGER" : "EMPLOYEE", passwordHash: hash, organizationId: o.id, lastLoginAt: i === 2 ? null : d(3), createdAt: d(Math.max(1, age - 5 - i * 7)) } });
    const client = await prisma.client.create({ data: { name: `${name} Client`, email: `client@${slug}.example`, company: name, organizationId: o.id } });
    for (const [pt, val] of [["Website Development", 100000], ["Support Services", 20000]] as const) {
      const proj = await prisma.project.create({ data: { name: `${name} — ${pt}`, clientId: client.id, projectType: pt, description: "x", organizationId: o.id, totalValue: val } });
      if (plan && status === "ACTIVE") {
        for (let k = 0; k < 4; k++) await prisma.payment.create({ data: { projectId: proj.id, clientId: client.id, organizationId: o.id, amount: (val / 10) * (k + 1), status: "CAPTURED", paidAt: d(k * 12 + 2), provider: "razorpay", providerPaymentId: `pay_${slug}_${pt.slice(0, 3)}_${k}` } });
      }
    }
  }
  // failed + cancelled + refunded payment in NextGen
  const ng = await prisma.project.findFirstOrThrow({ where: { organizationId: orgs.nextgen.id } });
  const ngc = await prisma.client.findFirstOrThrow({ where: { organizationId: orgs.nextgen.id } });
  await prisma.payment.create({ data: { projectId: ng.id, clientId: ngc.id, organizationId: orgs.nextgen.id, amount: 55555, status: "FAILED", failureReason: "bank declined" } });
  await prisma.payment.create({ data: { projectId: ng.id, clientId: ngc.id, organizationId: orgs.nextgen.id, amount: 44444, status: "CANCELLED" } });
  const refunded = await prisma.payment.create({ data: { projectId: ng.id, clientId: ngc.id, organizationId: orgs.nextgen.id, amount: 8000, status: "PARTIALLY_REFUNDED", paidAt: d(3) } });
  await prisma.refund.create({ data: { projectId: ng.id, paymentId: refunded.id, clientId: ngc.id, organizationId: orgs.nextgen.id, requestedById: owner.id, amount: 3000, reason: "duplicate", idempotencyKey: "k1", status: "PROCESSED", processedAt: d(2) } });
  await prisma.refund.create({ data: { projectId: ng.id, paymentId: refunded.id, clientId: ngc.id, organizationId: orgs.nextgen.id, requestedById: owner.id, amount: 1000, reason: "pending one", idempotencyKey: "k2", status: "REQUESTED" } });

  // internal staff + departments
  const dep = await prisma.department.create({ data: { name: "Customer Support" } });
  await prisma.department.create({ data: { name: "Technical Support" } });
  const sup = await prisma.user.create({ data: { email: "demo-agent@abyvora.example", name: "Priya Sharma", role: "AGENT", passwordHash: hash, departmentId: dep.id, lastLoginAt: d(0) } });
  const agent = await prisma.agent.create({ data: { userId: sup.id } });
  await prisma.user.create({ data: { email: "demo-it@abyvora.example", name: "Ravi IT", role: "IT_SUPPORT", passwordHash: hash, departmentId: dep.id } });
  await prisma.user.create({ data: { email: "demo-admin@abyvora.example", name: "Ops Admin", role: "ADMIN", passwordHash: hash } });

  // tickets
  const T = [["HIGH", "SUBMITTED", "nextgen", 2, null], ["MEDIUM", "ASSIGNED_TO_AGENT", "maple", 1, agent.id], ["LOW", "RESOLVED", "globalstudy", 6, agent.id], ["HIGH", "ESCALATED_TO_ADMIN", "aspire", 5, agent.id], ["MEDIUM", "SUBMITTED", "edufuture", 0, null]] as const;
  let n = 4821;
  for (const [pr, st, slug, ago, ag] of T) {
    const orgUser = await prisma.user.findFirstOrThrow({ where: { organizationId: orgs[slug].id } });
    const t = await prisma.supportTicket.create({ data: { ticketNumber: `T-${n--}`, title: `Issue for ${slug}`, description: "Something is broken", category: "BUG_REPORT", priority: pr, status: st, raisedById: orgUser.id, raisedByRole: "ORG_OWNER", organizationId: orgs[slug].id, assignedAgentId: ag, createdAt: d(ago, 0) } });
    await prisma.supportTicketMessage.create({ data: { ticketId: t.id, senderId: orgUser.id, senderRole: "ORG_OWNER", message: "Please help" } });
  }
  await prisma.auditLog.createMany({ data: [
    { actorRole: "SYSTEM", action: "organization.created", entityType: "Organization", organizationId: orgs.nextgen.id, description: "seed", createdAt: d(0) },
    { actorRole: "PLATFORM_OWNER", actorId: owner.id, actorName: "Abhishek Singh", action: "payment.captured", entityType: "Payment", status: "SUCCESS", createdAt: d(0) },
    { actorRole: "SYSTEM", action: "webhook.razorpay.invalid_signature", entityType: "Webhook", status: "FAILED", errorDetail: "bad sig", createdAt: d(0) },
  ] });
  await prisma.notification.create({ data: { userId: owner.id, type: "ORGANIZATION_DECISION", title: "Welcome notification", body: "hello" } });
  console.log("Demo data created. Open /admin to see it.");
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error("SEED ERR", e); process.exit(1); });
