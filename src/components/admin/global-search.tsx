"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";

type Hit = { id: string; type: string; title: string; subtitle?: string; href: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // `result` is tagged with the term it answers, so "loading" is derived (term changed, no answer yet)
  // instead of being set synchronously inside an effect.
  const [result, setResult] = useState<{ term: string; hits: Hit[]; error: boolean } | null>(null);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd + K focuses search from anywhere in the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      } else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
    };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);

  // Debounced server search; the API re-checks Platform Owner + MFA on every call.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error();
        setResult({ term, hits: (await res.json()).hits ?? [], error: false });
        setCursor(0);
      } catch (e) { if ((e as Error).name !== "AbortError") setResult({ term, hits: [], error: true }); }
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const term = q.trim();
  const fresh = result && result.term === term ? result : null;
  const hits = fresh?.hits ?? [];
  const state: "idle" | "loading" | "error" = term.length < 2 ? "idle" : !fresh ? "loading" : fresh.error ? "error" : "idle";
  const groups = hits.reduce<Record<string, Hit[]>>((a, h) => ((a[h.type] ??= []).push(h), a), {});

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === "Enter" && hits[cursor]) { window.location.href = hits[cursor].href; }
  }

  let idx = -1;
  return (
    <div ref={box} className="relative w-full max-w-[460px]">
      <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
        <Icon name="search" size={15} />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          placeholder="Search organizations, users, tickets, payments… (Ctrl + K)" aria-label="Global search"
          className="flex-1 bg-transparent outline-none text-[13px] min-w-0" style={{ color: "var(--text-primary)" }} />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }} role="listbox">
          {state === "loading" && <p className="px-4 py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Searching…</p>}
          {state === "error" && <p className="px-4 py-3 text-[12.5px]" style={{ color: "var(--danger)" }}>Search failed. Try again.</p>}
          {state === "idle" && hits.length === 0 && <p className="px-4 py-3 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>No results for “{q.trim()}”.</p>}
          {Object.entries(groups).map(([type, items]) => (
            <div key={type}>
              <div className="px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{type}s</div>
              {items.map((h) => {
                idx += 1;
                const mine = idx;
                return (
                  <Link key={`${h.type}-${h.id}`} href={h.href} onClick={() => setOpen(false)} role="option" aria-selected={cursor === mine}
                    className="block px-4 py-2 text-[13px]" style={{ background: cursor === mine ? "var(--accent-soft)" : "transparent", color: "var(--text-primary)" }}>
                    <div className="font-medium truncate">{h.title}</div>
                    {h.subtitle && <div className="text-[11.5px] truncate" style={{ color: "var(--text-secondary)" }}>{h.subtitle}</div>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
