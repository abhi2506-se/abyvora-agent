"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-60" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}
      onClick={async () => { setBusy(true); await fetch("/api/admin/health", { method: "POST" }); setBusy(false); router.refresh(); }}>{busy ? "Checking…" : "Run check now"}</button>
  );
}
