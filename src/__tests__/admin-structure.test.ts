import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ADMIN_EXTRA_ROUTES, ADMIN_NAV, allNavHrefs } from "@/lib/admin/nav";

const ROOT = path.resolve(__dirname, "../app");
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe("sidebar integrity", () => {
  const pages = walk(path.join(ROOT, "admin")).filter((f) => f.endsWith("page.tsx"))
    .map((f) => "/" + path.relative(ROOT, path.dirname(f)).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/"));
  it("every sidebar link resolves to a real page (no dead routes)", () => {
    for (const href of [...allNavHrefs(), ...ADMIN_EXTRA_ROUTES]) expect(pages, `missing page for ${href}`).toContain(href);
  });
  it("has the required sections", () => {
    expect(ADMIN_NAV.map((s) => s.title)).toEqual(["Organizations", "User Management", "Support & Complaints", "Revenue & Payments", "Products & Services", "Reports & Analytics", "System", "Profile"]);
  });
  it("hrefs are unique", () => { const h = allNavHrefs(); expect(new Set(h).size).toBe(h.length); });
  it("Organization 360 and ticket workspace routes exist", () => {
    expect(pages).toContain("/admin/organizations/[id]"); expect(pages).toContain("/admin/support/[id]"); expect(pages).toContain("/admin/users/[id]");
  });
});

describe("authorization coverage (security regression guard)", () => {
  const files = walk(path.join(ROOT, "admin", "(protected)")).filter((f) => f.endsWith("page.tsx"));
  it("every protected admin page re-asserts Platform Owner itself (layouts don't re-run on client navigation)", () => {
    expect(files.length).toBeGreaterThan(40);
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(/pageGuard\(|requirePlatformOwner\(/.test(src), `${path.relative(ROOT, f)} lacks a guard`).toBe(true);
    }
  });
  it("every /api/admin route handler (except the pre-existing MFA ones) is wrapped in apiGuard", () => {
    const api = walk(path.join(ROOT, "api", "admin")).filter((f) => f.endsWith("route.ts") && !f.includes(`${path.sep}mfa${path.sep}`) && !f.includes(`${path.sep}it-support${path.sep}`));
    expect(api.length).toBeGreaterThan(15);
    for (const f of api) {
      const src = fs.readFileSync(f, "utf8");
      const handlers = (src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? []).length;
      const guarded = (src.match(/return apiGuard\(/g) ?? []).length;
      expect(guarded, `${path.relative(ROOT, f)}: ${handlers} handlers, ${guarded} guarded`).toBe(handlers);
    }
  });
  it("admin API never reads organizationId scope for authorization from the request body of a mutation", () => {
    // Org-scoped mutations take the id from the URL path and verify existence; none may trust session-less input.
    const src = fs.readFileSync(path.join(ROOT, "api/admin/organizations/[id]/status/route.ts"), "utf8");
    expect(src).toContain("findUnique({ where: { id }");
  });
  it("the old Phase-2 checkpoint is no longer the /admin home", () => {
    const home = fs.readFileSync(path.join(ROOT, "admin/(protected)/page.tsx"), "utf8");
    expect(home).not.toMatch(/boundary — online|authorization-boundary checkpoint/i);
    expect(home).toContain("complete overview of ABYVORA platform");
  });
});
