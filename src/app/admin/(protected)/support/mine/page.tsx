import { pageGuard } from "@/lib/admin/guard";
import type { SP } from "@/lib/admin/paging";
import { TicketListPage } from "@/components/admin/ticket-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await pageGuard();
  return <TicketListPage view="mine" title="My Complaints" description="Tickets you raised or that are assigned to you." base="/admin/support/mine" sp={await searchParams} userId={session.user.id} />;
}
