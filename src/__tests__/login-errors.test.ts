import { describe, it, expect } from "vitest";
import { classifyDbError, loginErrorMessage } from "@/lib/login-errors";

describe("loginErrorMessage — the login screen must not blame the password for server problems", () => {
  it("a real bad password / unknown user says invalid credentials", () => {
    expect(loginErrorMessage({ error: "CredentialsSignin", code: "credentials" })).toBe("Invalid email or password.");
  });
  it("an un-migrated database gets an actionable message naming the command", () => {
    const m = loginErrorMessage({ error: "CredentialsSignin", code: "DATABASE_OUT_OF_DATE" })!;
    expect(m).toMatch(/prisma db push/); expect(m).not.toMatch(/invalid email or password/i);
  });
  it("a generic Configuration error (authorize crashed) is reported as a server error, not a wrong password", () => {
    expect(loginErrorMessage({ error: "Configuration" })).toMatch(/server error/i);
  });
  it("each lock-out reason has its own message", () => {
    for (const code of ["TOO_MANY_ATTEMPTS", "ACCOUNT_DISABLED", "ORGANIZATION_SUSPENDED", "DATABASE_UNREACHABLE", "SERVER_ERROR"]) {
      const m = loginErrorMessage({ error: "CredentialsSignin", code }); expect(m).toBeTruthy(); expect(m).not.toBe("Invalid email or password.");
    }
  });
  it("success (no error) returns null", () => expect(loginErrorMessage({ error: null })).toBeNull());
  it("ignores unknown codes rather than showing them raw", () => expect(loginErrorMessage({ error: "CredentialsSignin", code: "<script>" })).toBe("Invalid email or password."));
});

describe("classifyDbError", () => {
  it("missing column/table (P2022/P2021) → DATABASE_OUT_OF_DATE", () => {
    expect(classifyDbError({ code: "P2022" })).toBe("DATABASE_OUT_OF_DATE");
    expect(classifyDbError({ code: "P2021" })).toBe("DATABASE_OUT_OF_DATE");
    expect(classifyDbError(new Error("column User.teamId does not exist"))).toBe("DATABASE_OUT_OF_DATE");
  });
  it("connection failures → DATABASE_UNREACHABLE", () => {
    expect(classifyDbError({ code: "P1001" })).toBe("DATABASE_UNREACHABLE");
    expect(classifyDbError(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe("DATABASE_UNREACHABLE");
  });
  it("anything else → SERVER_ERROR", () => expect(classifyDbError(new Error("boom"))).toBe("SERVER_ERROR"));
});
