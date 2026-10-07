import { getIntegrationStatus } from "@/lib/admin/integrations";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/admin/ui";

export function IntegrationList() {
  const items = getIntegrationStatus();
  return (
    <Panel bodyClass="p-0">
      <ul>{items.map((i) => (
        <li key={i.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div><div className="font-semibold text-[13.5px]">{i.name}</div><div className="text-[11.5px] font-mono" style={{ color: "var(--text-muted)" }}>{i.vars.join(" · ")}</div></div>
          <Badge tone={i.configured ? "success" : "warning"}>{i.configured ? "Configured" : "Not configured"}</Badge>
        </li>))}</ul>
      <p className="px-5 py-3 text-[12px]" style={{ color: "var(--text-muted)" }}>Shows whether the environment variables are present — values are never displayed, and vendor availability isn’t probed.</p>
    </Panel>
  );
}
