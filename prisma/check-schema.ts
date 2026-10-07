/** npm run db:check — tells you whether the database matches the code, and exactly what to run if not. */
import { getSchemaProblems } from "@/lib/schema-check";
import { prisma } from "@/lib/prisma";

(async () => {
  try {
    const problems = await getSchemaProblems();
    if (problems.length === 0) { console.log("✓ Database schema is up to date."); return; }
    console.error("✗ The database is behind the code:\n  - " + problems.join("\n  - "));
    console.error("\nFix:  npx prisma db push     (then restart the dev server)\nUntil then, NO ONE can sign in — every User query fails.");
    process.exitCode = 1;
  } catch (e) {
    console.error("✗ Could not read the database:", e instanceof Error ? e.message : e, "\nCheck DATABASE_URL and that the database is running.");
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
