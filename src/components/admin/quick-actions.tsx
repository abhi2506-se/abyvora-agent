"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { Dialog as Modal } from "@/components/ui/dialog";
import { FormDialogButton } from "@/components/admin/action-form";
import { AddSupportAgentForm, AssignTicketForm, CreateDepartmentForm, CreateOrganizationForm, CreateUserForm, GenerateInvoiceForm } from "@/components/admin/forms";

type Dialog = { key: string; label: string; icon: string; title: string; render: (close: () => void) => React.ReactNode };
type LinkAction = { key: string; label: string; icon: string; href: string };

const DIALOGS: Dialog[] = [
  { key: "org", label: "Create Organization", icon: "building", title: "Create organization", render: (c) => <CreateOrganizationForm onDone={c} /> },
  { key: "user", label: "Create User", icon: "userPlus", title: "Create user", render: (c) => <CreateUserForm onDone={c} /> },
  { key: "ticket", label: "Assign Ticket", icon: "ticket", title: "Assign ticket", render: (c) => <AssignTicketForm onDone={c} /> },
  { key: "invoice", label: "Generate Invoice", icon: "file", title: "Generate invoice", render: (c) => <GenerateInvoiceForm onDone={c} /> },
  { key: "dept", label: "Create Department", icon: "tree", title: "Create department", render: (c) => <CreateDepartmentForm onDone={c} /> },
  { key: "agent", label: "Add Support Agent", icon: "users", title: "Add support agent", render: (c) => <AddSupportAgentForm onDone={c} /> },
];
const LINKS: LinkAction[] = [
  { key: "reports", label: "View Reports", icon: "chart", href: "/admin/reports/business" },
  { key: "plans", label: "Manage Plans", icon: "crown", href: "/admin/products/pricing" },
  { key: "settings", label: "System Settings", icon: "gear", href: "/admin/system/settings" },
];
const ORDER = ["org", "user", "ticket", "invoice", "dept", "agent", "reports", "plans", "settings"];

/** The 3×3 tile grid from the reference. Every tile opens a working form or navigates. */
export function QuickActionsGrid() {
  const all = ORDER.map((k) => DIALOGS.find((d) => d.key === k) ?? LINKS.find((l) => l.key === k)!);
  const tile = "flex flex-col items-center justify-center gap-2 rounded-xl py-3.5 px-2 text-[12px] font-medium text-center transition-colors hover:opacity-80";
  const style = { border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--surface)" } as const;
  return (
    <div className="grid grid-cols-3 gap-3">
      {all.map((a) =>
        "href" in a ? (
          <Link key={a.key} href={a.href} className={tile} style={style}><span style={{ color: "var(--brand)" }}><Icon name={a.icon} size={22} /></span>{a.label}</Link>
        ) : (
          <FormDialogButton key={a.key} title={a.title} className={tile} style={style} label={<><span style={{ color: "var(--brand)" }}><Icon name={a.icon} size={22} /></span>{a.label}</>}>
            {a.render}
          </FormDialogButton>
        )
      )}
    </div>
  );
}

/** The blue "Quick Actions" dropdown in the dashboard header. */
export function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);
  const item = "flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-left hover:opacity-70";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-semibold" style={{ background: "var(--brand)", color: "#fff", boxShadow: "0 6px 16px color-mix(in srgb, var(--brand) 30%, transparent)" }}>
        <Icon name="bolt" size={16} /> Quick Actions <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl py-1.5 z-40" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", color: "var(--text-primary)" }}>
          {ORDER.map((k) => {
            const d = DIALOGS.find((x) => x.key === k);
            const l = LINKS.find((x) => x.key === k);
            return d ? (
              <button key={k} type="button" className={item} onClick={() => { setOpen(false); setDialog(d); }}><Icon name={d.icon} size={15} />{d.label}</button>
            ) : (
              <Link key={k} href={l!.href} className={item} onClick={() => setOpen(false)}><Icon name={l!.icon} size={15} />{l!.label}</Link>
            );
          })}
        </div>
      )}
      <DialogHost dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function DialogHost({ dialog, onClose }: { dialog: Dialog | null; onClose: () => void }) {
  return <Modal open={!!dialog} onClose={onClose} title={dialog?.title}>{dialog?.render(onClose)}</Modal>;
}
