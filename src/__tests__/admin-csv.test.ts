import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "@/lib/admin/csv";

describe("csv export safety", () => {
  it("neutralizes spreadsheet formula injection", () => {
    for (const v of ["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)"]) expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("keeps real negative numbers numeric", () => expect(csvCell(-250.5)).toBe("-250.5"));
  it("quotes commas, quotes and newlines", () => expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
  it("serializes dates as ISO and nulls as empty", () => expect(toCsv(["d", "x"], [[new Date("2026-01-02T03:04:05Z"), null]])).toBe("d,x\r\n2026-01-02T03:04:05.000Z,\r\n"));
});
