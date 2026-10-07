"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SettingDef = { key: string; label: string; type: "text" | "number" | "boolean"; hint?: string };

/** Writes only allow-listed keys via PUT /api/admin/settings (validated + audited server-side). */
export function SettingsForm({ defs, initial }: { defs: SettingDef[]; initial: Record<string, string | number | boolean | undefined> }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = Object.fromEntries(defs.filter((d) => values[d.key] !== undefined && values[d.key] !== "").map((d) => [d.key, d.type === "number" ? Number(values[d.key]) : values[d.key]]));
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: payload }) });
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: "Settings saved." }); router.refresh(); }
    else setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Save failed" });
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      {defs.map((d) => (
        <div key={d.key}>
          {d.type === "boolean" ? (
            <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={!!values[d.key]} onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.checked }))} />{d.label}</label>
          ) : (
            <>
              <label className="field-label" htmlFor={d.key}>{d.label}</label>
              <input id={d.key} className="field-input" type={d.type} value={String(values[d.key] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))} />
            </>
          )}
          {d.hint && <p className="text-[11.5px] mt-1" style={{ color: "var(--text-muted)" }}>{d.hint}</p>}
        </div>
      ))}
      {msg && <p role="status" className="text-[12.5px]" style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-60" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
