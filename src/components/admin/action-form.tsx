"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "password" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  /** Static options, or fetch from /api/admin/options?kind=… */
  options?: { value: string; label: string }[];
  optionsKind?: string;
  /** When set, options reload whenever this other field changes (e.g. departments of the chosen org). */
  dependsOn?: string;
  optional?: boolean;
  defaultValue?: string | boolean;
  hint?: string;
};

type Values = Record<string, string | boolean>;

export type ActionFormProps = {
  endpoint: string | ((v: Values) => string);
  method?: "POST" | "PATCH" | "PUT";
  fields: FormField[];
  submitLabel: string;
  /** Map raw form values to the API body. Default: drop empty optional strings. */
  transform?: (v: Values) => unknown;
  /** Render something from the API response (e.g. a one-time temporary password). */
  renderResult?: (data: Record<string, unknown>) => React.ReactNode;
  onDone?: () => void;
};

function SelectField({ f, values, setValue }: { f: FormField; values: Values; setValue: (n: string, v: string) => void }) {
  const dep = f.dependsOn ? String(values[f.dependsOn] ?? "") : "";
  const cacheKey = `${f.optionsKind ?? ""}|${dep}`;
  // Options are tagged with the key they answer; "loading" = no answer for the current key yet.
  const [fetched, setFetched] = useState<{ key: string; options: { value: string; label: string }[] } | null>(null);
  useEffect(() => {
    if (f.options || !f.optionsKind) return;
    let live = true;
    const qs = new URLSearchParams({ kind: f.optionsKind });
    if (f.dependsOn) qs.set("orgId", dep);
    fetch(`/api/admin/options?${qs}`)
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((d) => live && setFetched({ key: cacheKey, options: d.options ?? [] }))
      .catch(() => live && setFetched({ key: cacheKey, options: [] }));
    return () => { live = false; };
  }, [f.options, f.optionsKind, f.dependsOn, dep, cacheKey]);

  const opts = f.options ?? (fetched && fetched.key === cacheKey ? fetched.options : null);
  return (
    <select
      id={`f-${f.name}`} className="field-input" required={f.required} value={String(values[f.name] ?? "")}
      onChange={(e) => setValue(f.name, e.target.value)} disabled={opts === null}
    >
      <option value="">{opts === null ? "Loading…" : f.required ? "Select…" : "None"}</option>
      {(opts ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ActionForm({ endpoint, method = "POST", fields, submitLabel, transform, renderResult, onDone }: ActionFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === "checkbox" ? false : "")])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const setValue = (n: string, v: string | boolean) => setValues((p) => ({ ...p, [n]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = transform
      ? transform(values)
      : Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" ));
    try {
      const res = await fetch(typeof endpoint === "function" ? endpoint(values) : endpoint, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? ` — ${data.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`).join("; ")}` : "";
        setError((data.error ?? "Request failed") + detail);
      } else {
        setResult(data);
        router.refresh();
        if (!renderResult) onDone?.();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result && renderResult) {
    return (
      <div className="space-y-4">
        {renderResult(result)}
        <button type="button" onClick={() => onDone?.()} className="btn-primary" style={{ padding: "8px 18px", borderRadius: 10 }}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.name}>
          {f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValue(f.name, e.target.checked)} /> {f.label}
            </label>
          ) : (
            <>
              <label className="field-label" htmlFor={`f-${f.name}`}>{f.label}{f.required && <span style={{ color: "var(--danger)" }}> *</span>}</label>
              {f.type === "select" ? (
                <SelectField f={f} values={values} setValue={setValue} />
              ) : f.type === "textarea" ? (
                <textarea id={`f-${f.name}`} className="field-input" rows={3} required={f.required} placeholder={f.placeholder} value={String(values[f.name])} onChange={(e) => setValue(f.name, e.target.value)} />
              ) : (
                <input id={`f-${f.name}`} className="field-input" type={f.type ?? "text"} step={f.type === "number" ? "any" : undefined} required={f.required} placeholder={f.placeholder} value={String(values[f.name])} onChange={(e) => setValue(f.name, e.target.value)} />
              )}
            </>
          )}
          {f.hint && <p className="text-[11.5px] mt-1" style={{ color: "var(--text-muted)" }}>{f.hint}</p>}
        </div>
      ))}
      {error && <p role="alert" className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        {onDone && <button type="button" onClick={onDone} className="px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-60" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>{busy ? "Working…" : submitLabel}</button>
      </div>
    </form>
  );
}

/** Shows a one-time generated credential. Never persisted client-side. */
export function CredentialResult({ email, password, note }: { email: string; password: string; note?: string }) {
  return (
    <div className="rounded-xl p-4 text-[13px]" style={{ background: "var(--success-soft)", color: "var(--text-primary)" }}>
      <p className="font-semibold mb-2" style={{ color: "var(--success)" }}>Created successfully</p>
      <p>Login: <b>{email}</b></p>
      <p className="mt-1">Temporary password: <code className="px-1.5 py-0.5 rounded" style={{ background: "var(--surface)" }}>{password}</code></p>
      <p className="mt-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>{note ?? "Shown once only — it is stored hashed and cannot be retrieved. Share it securely."}</p>
    </div>
  );
}

export function FormDialogButton({ label, title, description, className, style, children }: {
  label: React.ReactNode; title: string; description?: string; className?: string; style?: React.CSSProperties;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>{label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {open && children(() => setOpen(false))}
      </Dialog>
    </>
  );
}
