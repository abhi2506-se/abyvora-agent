import { describe, it, expect } from "vitest";
import { createOrganizationSchema, createUserSchema, decisionSchema, orgStatusSchema, settingsSchema, planSchema } from "@/lib/admin/schemas";

describe("settingsSchema (regression: Zod 4 z.record(z.enum) is exhaustive and rejected any partial save)", () => {
  it("accepts a single allow-listed key", () => expect(settingsSchema.safeParse({ values: { "platform.name": "ABYVORA" } }).success).toBe(true));
  it("accepts a partial save of mixed types", () => expect(settingsSchema.safeParse({ values: { "org.gracePeriodDays": 7, "security.mfaRequiredForStaff": true } }).success).toBe(true));
  it("rejects keys outside the allow-list (can't write arbitrary Setting rows)", () => { const r = settingsSchema.safeParse({ values: { "razorpay.secret": "x" } }); expect(r.success).toBe(false); });
  it("rejects an empty payload and over-long values", () => { expect(settingsSchema.safeParse({ values: {} }).success).toBe(false); expect(settingsSchema.safeParse({ values: { "platform.name": "x".repeat(301) } }).success).toBe(false); });
});

describe("organization / user / decision schemas", () => {
  it("createOrganization needs owner + contact details", () => { expect(createOrganizationSchema.safeParse({ name: "A" }).success).toBe(false); expect(createOrganizationSchema.safeParse({ name: "Acme", contactEmail: "a@b.co", ownerName: "Ann Lee", ownerEmail: "ann@b.co" }).success).toBe(true); });
  it("an empty website string is allowed (optional field left blank in the form)", () => expect(createOrganizationSchema.safeParse({ name: "Acme", contactEmail: "a@b.co", ownerName: "Ann Lee", ownerEmail: "ann@b.co", website: "" }).success).toBe(true));
  it("PLATFORM_OWNER can never be assigned through the API", () => expect(createUserSchema.safeParse({ name: "X Y", email: "x@y.co", role: "PLATFORM_OWNER" }).success).toBe(false));
  it("reject / request-changes require a real reason; approve doesn't", () => {
    expect(decisionSchema.safeParse({ decision: "APPROVED" }).success).toBe(true);
    expect(decisionSchema.safeParse({ decision: "REJECTED" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "REJECTED", reason: "no" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "CHANGES_REQUESTED", reason: "Add GST number" }).success).toBe(true);
  });
  it("suspend/terminate need an audited reason", () => { expect(orgStatusSchema.safeParse({ action: "terminate" }).success).toBe(false); expect(orgStatusSchema.safeParse({ action: "suspend", reason: "Non-payment" }).success).toBe(true); });
  it("plan slug is URL-safe and prices can't be negative", () => { expect(planSchema.safeParse({ name: "Gold", slug: "Gold Plan!", priceMonthly: 1 }).success).toBe(false); expect(planSchema.safeParse({ name: "Gold", slug: "gold", priceMonthly: -5 }).success).toBe(false); expect(planSchema.safeParse({ name: "Gold", slug: "gold", priceMonthly: 99 }).success).toBe(true); });
});
