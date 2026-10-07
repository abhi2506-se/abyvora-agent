import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runHealthChecks } from "@/lib/admin/health";

/**
 * Scheduled uptime probe. Point any cron (Vercel Cron, GitHub Actions, an
 * external monitor) at GET /api/cron/health every 1–5 minutes with
 * `Authorization: Bearer $CRON_SECRET`. With CRON_SECRET unset the route is
 * disabled (503) — it never runs unauthenticated.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const components = await runHealthChecks({ record: true });
  return NextResponse.json({ ok: true, checked: components.length });
}
