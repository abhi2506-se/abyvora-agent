import { NextRequest, NextResponse } from "next/server";
import { apiGuard } from "@/lib/admin/api";
import { globalSearch } from "@/lib/admin/search";
import { cleanQuery } from "@/lib/admin/query";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  return apiGuard(async (session) => {
    const rl = checkRateLimit(`admin-search:${session.user.id}`, 60, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Too many searches — slow down" }, { status: 429 });
    const q = cleanQuery(req.nextUrl.searchParams.get("q"));
    if (!q) return NextResponse.json({ hits: [] });
    return NextResponse.json({ hits: await globalSearch(q) });
  });
}
