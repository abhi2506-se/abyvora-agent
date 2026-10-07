"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, FormDialogButton } from "@/components/admin/action-form";

const BTN = "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold disabled:opacity-50";

/** Approve is one click; reject / request-changes require a written reason (enforced server-side too). */
export function OrgDecisionButtons({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/organizations/${orgId}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVED" }) });
    setBusy(false);
    if (res.ok) router.refresh(); else setError((await res.json().catch(() => ({}))).error ?? "Failed");
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={BTN} disabled={busy} style={{ background: "var(--success)", color: "#fff" }} onClick={approve}>{busy ? "Approving…" : "Approve"}</button>
      <FormDialogButton label="Request changes" title={`Request changes — ${orgName}`} className={BTN} style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
        {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/decision`} submitLabel="Send request" onDone={c}
          transform={(v) => ({ decision: "CHANGES_REQUESTED", reason: v.reason })} fields={[{ name: "reason", label: "What needs to change?", type: "textarea", required: true }]} />}
      </FormDialogButton>
      <FormDialogButton label="Reject" title={`Reject — ${orgName}`} className={BTN} style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
        {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/decision`} submitLabel="Reject organization" onDone={c}
          transform={(v) => ({ decision: "REJECTED", reason: v.reason })} fields={[{ name: "reason", label: "Reason for rejection", type: "textarea", required: true }]} />}
      </FormDialogButton>
      {error && <span role="alert" className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

export function OrgLifecycleButtons({ orgId, status }: { orgId: string; status: string }) {
  const action = (a: "suspend" | "reactivate" | "terminate", label: string, danger = false) => (
    <FormDialogButton key={a} label={label} title={`${label} organization`} description={a === "terminate" ? "Termination blocks all org users from signing in and ends the subscription." : undefined}
      className={BTN} style={danger ? { background: "var(--danger-soft)", color: "var(--danger)" } : { border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/status`} submitLabel={label} onDone={c} transform={(v) => ({ action: a, reason: v.reason })}
        fields={[{ name: "reason", label: "Reason (audited)", type: "textarea", required: true }]} />}
    </FormDialogButton>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {["ACTIVE", "GRACE_PERIOD"].includes(status) && action("suspend", "Suspend")}
      {["SUSPENDED", "GRACE_PERIOD"].includes(status) && action("reactivate", "Reactivate")}
      {["ACTIVE", "GRACE_PERIOD", "SUSPENDED", "APPROVED"].includes(status) && action("terminate", "Terminate", true)}
    </div>
  );
}

export function SubscriptionControls({ orgId, hasSubscription }: { orgId: string; hasSubscription: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <FormDialogButton label={hasSubscription ? "Change plan" : "Start subscription"} title="Change plan" className={BTN} style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>
        {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/subscription`} method="PATCH" submitLabel="Apply plan" onDone={c}
          fields={[{ name: "planId", label: "New plan", type: "select", optionsKind: "plans", required: true, hint: "Moving to a plan with a lower user cap than current usage is rejected." }]} />}
      </FormDialogButton>
      {hasSubscription && (
        <>
          <FormDialogButton label="Payment failed → grace" title="Start grace period" className={BTN} style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/subscription`} method="PATCH" submitLabel="Start grace period" onDone={c}
              transform={(v) => ({ status: "GRACE_PERIOD", graceDays: Number(v.graceDays || 7) })} fields={[{ name: "graceDays", label: "Grace days", type: "number", defaultValue: "7" }]} />}
          </FormDialogButton>
          <FormDialogButton label="Mark active" title="Mark subscription active" className={BTN} style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/subscription`} method="PATCH" submitLabel="Mark active" onDone={c} transform={() => ({ status: "ACTIVE" })} fields={[]} />}
          </FormDialogButton>
          <FormDialogButton label="Suspend billing" title="Suspend subscription" className={BTN} style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            {(c) => <ActionForm endpoint={`/api/admin/organizations/${orgId}/subscription`} method="PATCH" submitLabel="Suspend" onDone={c} transform={() => ({ status: "SUSPENDED" })} fields={[]} />}
          </FormDialogButton>
        </>
      )}
    </div>
  );
}
