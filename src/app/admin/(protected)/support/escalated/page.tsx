import { pageGuard } from "@/lib/admin/guard";
import type { SP } from "@/lib/admin/paging";
import { TicketListPage } from "@/components/admin/ticket-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await pageGuard();
  return <TicketListPage view="escalated" title="Escalated" description="Tickets escalated to admin awaiting a decision." base="/admin/support/escalated" sp={await searchParams} userId={session.user.id} />;
}
