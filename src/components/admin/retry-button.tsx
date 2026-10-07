"use client";
import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className="adm-link-text">
      Retry
    </button>
  );
}
