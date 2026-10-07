/** Sanitises a user-typed search query: trims, caps length, never matches on empty/1-char input. Pure. */
export function cleanQuery(q: string | null | undefined): string | null {
  const t = (q ?? "").trim().slice(0, 80);
  return t.length >= 2 ? t : null;
}
