import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { IntegrationList } from "@/components/admin/integration-list";

export const dynamic = "force-dynamic";
export default async function ProductIntegrationsPage() { await pageGuard(); return (<><PageHeader title="Integrations" description="Third-party services the platform depends on." /><IntegrationList /></>); }
