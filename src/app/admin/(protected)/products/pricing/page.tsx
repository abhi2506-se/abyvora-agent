import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { NewPlanButton } from "@/components/admin/forms";
import { PlansView } from "@/components/admin/plans-view";

export const dynamic = "force-dynamic";
export default async function PricingPage() {
  await pageGuard();
  return (<><PageHeader title="Plans & Pricing" description="Create plans and edit pricing. Price changes affect new subscriptions; existing subscriptions keep their plan." actions={<NewPlanButton />} /><PlansView /></>);
}
