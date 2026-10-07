import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiGuard, conflict, slugify, tempPassword } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { createOrganizationSchema } from "@/lib/admin/schemas";
import { listOrganizations } from "@/lib/admin/lists";
import { oneOf, parsePage } from "@/lib/admin/paging";
import { writeAuditLog } from "@/lib/audit";

const STATUSES = ["PENDING_REVIEW","CHANGES_REQUESTED","APPROVED","ACTIVE","GRACE_PERIOD","SUSPENDED","TERMINATED","REJECTED"] as const;

export async function GET(req: NextRequest) {
  return apiGuard(async () => {
    const sp = req.nextUrl.searchParams;
    const data = await listOrganizations({
      q: sp.get("q") ?? undefined,
      status: oneOf(sp.get("status") ?? undefined, STATUSES),
      planSlug: sp.get("plan") ?? undefined,
      page: parsePage(sp.get("page") ?? undefined),
    });
    return NextResponse.json(data);
  });
}

/**
 * Platform-Owner-created organization: goes straight to ACTIVE (the owner IS
 * the approver) with an ORG_OWNER login. The temporary password is returned
 * exactly once and only its bcrypt hash is stored.
 */
export async function POST(req: NextRequest) {
  return apiGuard(async (session) => {
    const data = createOrganizationSchema.parse(await req.json());

    const email = data.ownerEmail.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return conflict("A user with the owner's email already exists");

    const plan = data.planId ? await prisma.subscriptionPlan.findFirst({ where: { id: data.planId, active: true } }) : null;
    if (data.planId && !plan) return NextResponse.json({ error: "Plan not found or inactive" }, { status: 400 });

    let slug = slugify(data.name);
    if (await prisma.organization.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const password = tempPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({
        data: {
          name: data.name, legalName: data.legalName || null, slug, industry: data.industry || null,
          website: data.website || null, contactEmail: data.contactEmail, contactPhone: data.contactPhone || null,
          status: "ACTIVE", approvedById: session.user.id, approvedAt: now, planId: plan?.id ?? null,
        },
      });
      const owner = await tx.user.create({
        data: { name: data.ownerName, email, passwordHash, role: "ORG_OWNER", status: "ACTIVE", organizationId: o.id },
      });
      await tx.organization.update({ where: { id: o.id }, data: { ownerId: owner.id } });
      if (plan) {
        await tx.organizationSubscription.create({
          data: { organizationId: o.id, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000) },
        });
      }
      await tx.organizationApproval.create({ data: { organizationId: o.id, reviewerId: session.user.id, decision: "APPROVED", reason: "Created by Platform Owner" } });
      return o;
    });

    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: org.id, action: "organization.created",
      entityType: "Organization", entityId: org.id, description: `Platform Owner created organization "${org.name}"`,
      newValue: { name: org.name, slug, planId: plan?.id ?? null },
    });
    return NextResponse.json({ organization: { id: org.id, name: org.name, slug }, ownerLogin: { email, temporaryPassword: password } }, { status: 201 });
  });
}
