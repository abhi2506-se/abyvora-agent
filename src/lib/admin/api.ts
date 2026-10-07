import { NextResponse } from "next/server";
import { ZodError } from "zod";
import crypto from "crypto";
import { requirePlatformOwner, toApiError } from "@/lib/authz";

type OwnerSession = Awaited<ReturnType<typeof requirePlatformOwner>>;

/**
 * Wraps every /api/admin/* handler: enforces PLATFORM_OWNER + MFA-verified
 * server-side, maps validation + authz errors to JSON. Handlers never see a
 * request that hasn't passed requirePlatformOwner().
 */
export async function apiGuard(fn: (session: OwnerSession) => Promise<Response>): Promise<Response> {
  try {
    const session = await requirePlatformOwner();
    return await fn(session);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 }
      );
    }
    const { status, message } = toApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export function tempPassword(): string {
  // 14 chars, guaranteed letter + digit (satisfies lib/password isWeakPassword).
  const raw = crypto.randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "x").slice(0, 12);
  return `${raw}a7`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}
export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
