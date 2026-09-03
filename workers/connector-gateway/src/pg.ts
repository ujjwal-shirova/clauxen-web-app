import type { Sql } from "postgres";

type SqlTag = Pick<Sql, never> & ((
  template: TemplateStringsArray,
  ...parameters: readonly unknown[]
) => unknown);

export function parseTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
  }
  if (typeof value !== "string") return [];
  const inner = value.replace(/^\{|\}$/g, "").trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((part) => part.replace(/^"(.*)"$/s, "$1").trim())
    .filter(Boolean);
}

function textArrayLiteral(values: unknown): string {
  const items = parseTextArray(values);
  return `{${items
    .map((item) => `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")}}`;
}

/**
 * Bind a JS string[] as Postgres text[].
 * sql.array() cannot be used here: the worker sets fetch_types: false, so
 * postgres.js never learns the text[] OID and sends arrays as text.
 */
export function textArray(sql: SqlTag, values: unknown) {
  return sql`${textArrayLiteral(values)}::text[]`;
}
