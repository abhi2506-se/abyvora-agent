import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { NewPlanButton } from "@/components/admin/forms";
import { PlansView } from "@/components/admin/plans-view";

export const dynamic = "force-dynamic";

export default async function SubscriptionPlansPage() {
  await pageGuard();
  return (<><PageHeader title="Subscription Plans" description="Plans organizations can subscribe to. Entitlements are enforced server-side." actions={<NewPlanButton />} /><PlansView /></>);
}
