import { redirect } from "next/navigation";
import { AuthzError, requirePlatformOwner } from "@/lib/authz";

/**
 * Every /admin page calls this FIRST. A layout alone is not enough: Next.js
 * does not re-run layouts on client-side navigation between sibling pages, so
 * each page re-asserts Platform Owner + MFA-verified-this-session itself.
 */
export async function pageGuard() {
  try {
    return await requirePlatformOwner();
  } catch (err) {
    if (err instanceof AuthzError && err.status === 401) redirect("/admin/mfa");
    redirect("/dashboard");
  }
}
