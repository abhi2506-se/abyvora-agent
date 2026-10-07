/** Runs once when the server starts. Warns loudly if the database hasn't been migrated, so a lock-out is obvious in the terminal. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getSchemaProblems } = await import("@/lib/schema-check");
    const problems = await getSchemaProblems();
    if (problems.length) {
      console.error(
        `\n\x1b[31m⚠ DATABASE SCHEMA IS OUT OF DATE — sign-in will fail until you run:\n    npx prisma db push\n  (${problems.join("; ")})\x1b[0m\n`
      );
    }
  } catch {
    /* database unreachable at boot: the login page reports that separately */
  }
}
