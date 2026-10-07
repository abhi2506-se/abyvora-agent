import { z } from "zod";

/** Roles a Platform Owner may assign. PLATFORM_OWNER is deliberately absent —
 *  it can only be created out-of-band via `npm run create-owner`. */
export const ASSIGNABLE_ROLES = [
  "ADMIN", "AGENT", "CLIENT", "IT_SUPPORT",
  "ORG_OWNER", "ORG_ADMIN", "HIGHER_MANAGER", "MID_MANAGER", "LOWER_MANAGER", "HR", "EMPLOYEE",
] as const;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(80).optional(),
  website: z.string().trim().url().max(200).optional().or(z.literal("")),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().max(30).optional(),
  planId: z.string().optional(),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email(),
});

export const updateOrganizationSchema = createOrganizationSchema
  .pick({ name: true, legalName: true, industry: true, website: true, contactEmail: true, contactPhone: true })
  .partial();

export const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.decision === "APPROVED" || (v.reason && v.reason.length >= 5), {
    message: "A reason (min 5 characters) is required to reject or request changes",
    path: ["reason"],
  });

export const orgStatusSchema = z.object({
  action: z.enum(["suspend", "reactivate", "terminate"]),
  reason: z.string().trim().min(5).max(2000),
});

export const subscriptionChangeSchema = z.object({
  planId: z.string().optional(),
  status: z.enum(["ACTIVE", "PAYMENT_DUE", "GRACE_PERIOD", "SUSPENDED", "TERMINATED"]).optional(),
  graceDays: z.number().int().min(1).max(60).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(ASSIGNABLE_ROLES),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  managerId: z.string().optional(),
});

export const updateUserSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  departmentId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
});

export const supportAgentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional(),
  type: z.enum(["AGENT", "IT_SUPPORT"]),
  departmentId: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  organizationId: z.string().optional(),
});

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  departmentId: z.string().optional(),
  organizationId: z.string().optional(),
});

export const planSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "lowercase letters, numbers, dashes"),
  priceMonthly: z.number().nonnegative().max(10_000_000),
  priceYearly: z.number().nonnegative().max(100_000_000).optional(),
  features: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  active: z.boolean().default(true),
});
export const planUpdateSchema = planSchema.partial();

export const SETTING_KEYS = [
  "platform.name",
  "platform.supportEmail",
  "org.requireApproval",
  "org.defaultPlanSlug",
  "org.gracePeriodDays",
  "security.mfaRequiredForStaff",
  "billing.invoiceTaxLabel",
] as const;

// NOTE: z.record(z.enum([...])) is *exhaustive* in Zod 4 (every key required), which would reject any
// partial save. Validate values by key-agnostic record, then enforce the allow-list explicitly.
export const settingsSchema = z.object({
  values: z
    .record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()]))
    .superRefine((v, ctx) => {
      for (const k of Object.keys(v)) {
        if (!(SETTING_KEYS as readonly string[]).includes(k)) ctx.addIssue({ code: "custom", message: `Setting "${k}" is not editable`, path: [k] });
      }
      if (Object.keys(v).length === 0) ctx.addIssue({ code: "custom", message: "No settings provided" });
    }),
});

export const kbSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(60).default("General"),
  body: z.string().trim().min(10).max(20000),
  published: z.boolean().default(false),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
});

export const notificationPatchSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string()).min(1).max(100) }),
]);
