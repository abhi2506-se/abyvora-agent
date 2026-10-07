/**
 * Maps a sign-in failure to something a person can act on. Pure (no Next/Prisma) so it's unit-tested.
 *
 * Auth.js turns ANY non-CredentialsSignin error thrown inside authorize() into a generic
 * `Configuration` error, which used to surface as "Invalid email or password" — hiding real
 * problems (e.g. a database that hasn't been migrated). authorize() now throws codes via
 * LoginError (see lib/auth.ts) and this maps them.
 */
export const LOGIN_ERROR_CODES = [
  "TOO_MANY_ATTEMPTS",
  "ACCOUNT_DISABLED",
  "ORGANIZATION_SUSPENDED",
  "DATABASE_OUT_OF_DATE",
  "DATABASE_UNREACHABLE",
  "SERVER_ERROR",
] as const;
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

const MESSAGES: Record<LoginErrorCode, string> = {
  TOO_MANY_ATTEMPTS: "Too many login attempts. Please wait a few minutes and try again.",
  ACCOUNT_DISABLED: "This account has been disabled. Contact your administrator.",
  ORGANIZATION_SUSPENDED: "Your organization's access is suspended. Contact ABYVORA support.",
  DATABASE_OUT_OF_DATE:
    "The database schema is out of date, so sign-in can't work yet. Run `npx prisma db push` in the project folder, then restart the server.",
  DATABASE_UNREACHABLE: "The server can't reach the database. Check DATABASE_URL and that the database is running.",
  SERVER_ERROR: "Sign-in failed because of a server error. Check the server logs for details.",
};

export function loginErrorMessage(res: { error?: string | null; code?: string | null } | undefined | null): string | null {
  if (!res?.error) return null;
  const code = res.code && (LOGIN_ERROR_CODES as readonly string[]).includes(res.code) ? (res.code as LoginErrorCode) : null;
  if (code) return MESSAGES[code];
  // Legacy: some builds report the code in `error` itself.
  if ((LOGIN_ERROR_CODES as readonly string[]).includes(res.error)) return MESSAGES[res.error as LoginErrorCode];
  // A generic Configuration error means authorize() crashed unexpectedly — NOT that the password was wrong.
  if (res.error === "Configuration") return MESSAGES.SERVER_ERROR;
  return "Invalid email or password.";
}

/** Classifies a thrown Prisma error from the login query. */
export function classifyDbError(err: unknown): LoginErrorCode {
  const code = (err as { code?: string } | null)?.code;
  const text = String((err as { message?: string } | null)?.message ?? "");
  if (code === "P2021" || code === "P2022" || /does not exist/i.test(text)) return "DATABASE_OUT_OF_DATE";
  if (code === "P1001" || code === "P1002" || code === "P1017" || /can't reach database|ECONNREFUSED/i.test(text)) return "DATABASE_UNREACHABLE";
  return "SERVER_ERROR";
}
