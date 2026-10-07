import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForm, type SettingDef } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
const DEFS: SettingDef[] = [
  { key: "org.requireApproval", label: "Require Platform Owner approval for new organizations", type: "boolean" },
  { key: "org.defaultPlanSlug", label: "Default plan slug", type: "text", hint: "Suggested plan when approving an organization." },
  { key: "org.gracePeriodDays", label: "Default grace period (days)", type: "number", hint: "Pre-fills the grace period when a payment fails." },
];

export default async function OrgSettingsPage() {
  await pageGuard();
  const rows = await prisma.setting.findMany({ where: { key: { in: DEFS.map((d) => d.key) } } });
  const initial = Object.fromEntries(rows.map((r) => [r.key, r.value as string | number | boolean]));
  return (<><PageHeader title="Organization Settings" description="Platform-wide defaults for organization onboarding and billing grace." /><Panel><SettingsForm defs={DEFS} initial={initial} /></Panel></>);
}
