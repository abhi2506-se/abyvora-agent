/** CSV serialisation with spreadsheet-formula-injection protection. Pure. */
export type Cell = string | number | boolean | Date | null | undefined;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  // Excel/Sheets execute cells starting with = + - @ (and tab/CR) as formulas.
  // Numbers are exempt (a legitimate negative amount must stay numeric).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  return [columns.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n") + "\r\n";
}
