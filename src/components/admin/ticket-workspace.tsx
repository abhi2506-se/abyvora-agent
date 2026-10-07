"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";

type Props = { ticketId: string; status: string; priority: string; canReview: boolean; canAssign: boolean };

/** Platform Owner controls on a ticket. Each button calls the EXISTING support API; the server re-checks role + state transitions. */
export function TicketControls({ ticketId, status, priority, canReview, canAssign }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "assign" | "forward" | "reject" | "reopen" | "note">(null);

  async function call(label: string, url: string, method: string, body?: unknown) {
    setBusy(label); setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "Action failed"); else { setPanel(null); router.refresh(); }
    } catch { setError("Network error"); } finally { setBusy(null); }
  }
  const base = `/api/support/tickets/${ticketId}`;
  const btn = "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold disabled:opacity-50";
  const outline = { border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--surface)" } as const;
  const solid = { background: "var(--brand)", color: "var(--brand-contrast)" } as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canReview && <button className={btn} style={solid} disabled={!!busy} onClick={() => call("review", `${base}/status`, "PATCH", { status: "ADMIN_REVIEW" })}>{busy === "review" ? "Starting…" : "Start review"}</button>}
        {canAssign && <button className={btn} style={solid} onClick={() => setPanel(panel === "assign" ? null : "assign")}>Assign</button>}
        {["ADMIN_REVIEW", "ASSIGNED_TO_AGENT", "ESCALATED_TO_ADMIN", "REOPENED"].includes(status) && (
          <button className={btn} style={outline} onClick={() => setPanel("forward")}>Forward to IT</button>)}
        {status === "ESCALATED_TO_ADMIN" && (<>
          <button className={btn} style={solid} disabled={!!busy} onClick={() => call("approve", `${base}/approve-escalation`, "POST")}>Approve escalation</button>
          <button className={btn} style={outline} onClick={() => setPanel("reject")}>Reject escalation</button></>)}
        {status === "RESOLVED" && <button className={btn} style={solid} disabled={!!busy} onClick={() => call("close", `${base}/close`, "POST")}>Close ticket</button>}
        {["RESOLVED", "CLOSED"].includes(status) && <button className={btn} style={outline} onClick={() => setPanel("reopen")}>Reopen</button>}
        <button className={btn} style={outline} onClick={() => setPanel("note")}>Internal note</button>
        <select aria-label="Change priority" value={priority} disabled={!!busy} className={btn} style={outline}
          onChange={(e) => call("priority", `${base}/priority`, "PATCH", { priority: e.target.value })}>
          {["LOW", "MEDIUM", "HIGH"].map((p) => <option key={p} value={p}>Priority: {p[0] + p.slice(1).toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</p>}

      {panel === "assign" && (
        <div className="adm-card p-4"><ActionForm endpoint={`${base}/assign`} submitLabel="Assign" onDone={() => setPanel(null)}
          fields={[
            { name: "assignToType", label: "Assign to", type: "select", required: true, options: [{ value: "AGENT", label: "Support agent" }, { value: "IT_SUPPORT", label: "IT specialist" }] },
            { name: "agentId", label: "Agent", type: "select", optionsKind: "agents" },
            { name: "itSupportUserId", label: "IT specialist", type: "select", optionsKind: "it" },
            { name: "reason", label: "Note", type: "textarea" }]} /></div>)}
      {panel === "forward" && (
        <div className="adm-card p-4"><ActionForm endpoint={`${base}/forward`} submitLabel="Forward to IT" onDone={() => setPanel(null)} fields={[{ name: "reason", label: "Note for IT", type: "textarea" }]} /></div>)}
      {panel === "reject" && (
        <div className="adm-card p-4"><ActionForm endpoint={`${base}/reject-escalation`} submitLabel="Reject escalation" onDone={() => setPanel(null)} fields={[{ name: "reason", label: "Reason (shown to the agent)", type: "textarea", required: true }]} /></div>)}
      {panel === "reopen" && (
        <div className="adm-card p-4"><ActionForm endpoint={`${base}/reopen`} submitLabel="Reopen ticket" onDone={() => setPanel(null)} fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]} /></div>)}
      {panel === "note" && (
        <div className="adm-card p-4"><ActionForm endpoint={`${base}/messages`} submitLabel="Add internal note" onDone={() => setPanel(null)}
          transform={(v) => ({ message: v.message, isInternal: true })} fields={[{ name: "message", label: "Internal note (not visible to the customer)", type: "textarea", required: true }]} /></div>)}
    </div>
  );
}

export function ReplyBox({ ticketId }: { ticketId: string }) {
  return (
    <ActionForm endpoint={`/api/support/tickets/${ticketId}/messages`} submitLabel="Send reply"
      transform={(v) => ({ message: v.message })} fields={[{ name: "message", label: "Reply to customer", type: "textarea", required: true }]} />
  );
}
