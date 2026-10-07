"use client";

import { useRouter } from "next/navigation";
import { ActionForm, FormDialogButton } from "@/components/admin/action-form";

export function NewArticleButton() {
  return (
    <FormDialogButton label="+ New article" title="New knowledge-base article" className="inline-flex items-center px-4 py-2 rounded-lg text-[13px] font-semibold" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>
      {(c) => <ActionForm endpoint="/api/admin/knowledge-base" submitLabel="Save article" onDone={c}
        transform={(v) => ({ title: v.title, category: v.category || "General", body: v.body, published: !!v.published })}
        fields={[{ name: "title", label: "Title", required: true }, { name: "category", label: "Category", defaultValue: "General" }, { name: "body", label: "Content", type: "textarea", required: true }, { name: "published", label: "Publish immediately", type: "checkbox" }]} />}
    </FormDialogButton>
  );
}

export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className="adm-link-text" onClick={async () => {
      await fetch(`/api/admin/knowledge-base/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !published }) });
      router.refresh();
    }}>{published ? "Unpublish" : "Publish"}</button>
  );
}
