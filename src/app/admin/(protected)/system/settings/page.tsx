import { pageGuard } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForm, type SettingDef } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
const DEFS: SettingDef[] = [
  { key: "platform.name", label: "Platform name", type: "text" },
  { key: "platform.supportEmail", label: "Support contact email", type: "text" },
  { key: "security.mfaRequiredForStaff", label: "Require MFA for ABYVORA staff", type: "boolean", hint: "Recorded policy flag. Platform Owner MFA is always enforced in code regardless of this setting." },
  { key: "billing.invoiceTaxLabel", label: "Default invoice tax label", type: "text", hint: "e.g. GST. Labelling only — tax amounts are never auto-calculated." },
];

export default async function SystemSettingsPage() {
  await pageGuard();
  const rows = await prisma.setting.findMany({ where: { key: { in: DEFS.map((d) => d.key) } } });
  return (<><PageHeader title="System Settings" description="Allow-listed platform settings. Every change is audited." /><Panel><SettingsForm defs={DEFS} initial={Object.fromEntries(rows.map((r) => [r.key, r.value as string | number | boolean]))} /></Panel></>);
}
