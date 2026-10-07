import { prisma } from "@/lib/prisma";

/** Tables/columns the Platform Owner release added. If any are missing, `prisma db push` hasn't been run. */
export const REQUIRED_TABLES = ["Team", "KnowledgeArticle", "HealthCheck"] as const;
export const REQUIRED_COLUMNS: [table: string, column: string][] = [
  ["User", "teamId"],
  ["User", "lastLoginAt"],
];

export async function getSchemaProblems(): Promise<string[]> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_schema = current_schema()::text`;
  const cols = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns WHERE table_schema = current_schema()::text`;
  const haveTables = new Set(tables.map((t) => t.table_name));
  const haveCols = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
  return [
    ...REQUIRED_TABLES.filter((t) => !haveTables.has(t)).map((t) => `missing table "${t}"`),
    ...REQUIRED_COLUMNS.filter(([t, c]) => !haveCols.has(`${t}.${c}`)).map(([t, c]) => `missing column "${t}"."${c}"`),
  ];
}
