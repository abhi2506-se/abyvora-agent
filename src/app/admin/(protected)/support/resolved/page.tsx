import { pageGuard } from "@/lib/admin/guard";
import type { SP } from "@/lib/admin/paging";
import { TicketListPage } from "@/components/admin/ticket-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await pageGuard();
  return <TicketListPage view="resolved" title="Resolved Tickets" description="Resolved and closed tickets." base="/admin/support/resolved" sp={await searchParams} userId={session.user.id} />;
}
