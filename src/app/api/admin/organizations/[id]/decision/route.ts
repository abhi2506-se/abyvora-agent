import { NextRequest, NextResponse } from "next/server";
import { apiGuard, conflict, notFound } from "@/lib/admin/api";
import { prisma } from "@/lib/prisma";
import { decisionSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { clearMemo } from "@/lib/admin/memo";

/** Approve / reject / request changes on an organization registration. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(async (session) => {
    const { id } = await params;
    const { decision, reason } = decisionSchema.parse(await req.json());

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return notFound("Organization not found");
    if (!["PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(org.status)) {
      return conflict(`Organization is ${org.status}; it is no longer awaiting a decision`);
    }

    const nextStatus =
      decision === "APPROVED" ? (org.planId ? "ACTIVE" : "APPROVED") : decision === "REJECTED" ? "REJECTED" : "CHANGES_REQUESTED";

    await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(decision === "APPROVED" ? { approvedById: session.user.id, approvedAt: new Date(), rejectedReason: null } : {}),
          ...(decision === "REJECTED" ? { rejectedReason: reason } : {}),
        },
      }),
      prisma.organizationApproval.create({ data: { organizationId: id, reviewerId: session.user.id, decision, reason: reason ?? null } }),
    ]);

    await writeAuditLog({
      actorId: session.user.id, actorRole: session.user.role, organizationId: id,
      action: decision === "APPROVED" ? "organization.approved" : decision === "REJECTED" ? "organization.rejected" : "organization.changes_requested",
      entityType: "Organization", entityId: id, description: `${decision.replace("_", " ").toLowerCase()}: "${org.name}"`,
      previousValue: { status: org.status }, newValue: { status: nextStatus, reason },
    });

    if (org.ownerId) {
      await notifyUser({
        userId: org.ownerId, type: "ORGANIZATION_DECISION", entityType: "Organization", entityId: id,
        title: `Your organization was ${decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "sent back for changes"}`,
        body: reason,
      }).catch(() => undefined);
    }
    clearMemo("nav-counts");
    return NextResponse.json({ status: nextStatus });
  });
}
