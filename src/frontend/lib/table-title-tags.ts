import { parseTagAttributes } from "@/frontend/lib/create-file-tags";

export type ParsedTableSegment =
  | { type: "markdown"; content: string }
  | { type: "titled_table"; id: string; title: string; tableMarkdown: string };

const TABLE_TITLE_OPEN_RE = /<table_title(\s[^>]*)?\s*\/?>/gi;
const TABLE_TITLE_CLOSE_RE = /^\s*<\/table_title>/i;
// ponytail: naive "starts with |" heuristic — matches the leading-pipe GFM
// style the system prompt asks for. A table written without a leading pipe
// on every row won't be captured here; it just falls through and renders as
// a normal (untitled) table instead of breaking.
const TABLE_BLOCK_RE = /^[ \t]*\n*((?:[ \t]*\|.*(?:\n|$))*)/;

/**
 * Split assistant content around `<table_title title="...">` markers that
 * immediately precede a markdown table, so the table can render with its own
 * title + download header instead of going through the generic markdown path.
 */
export function parseTitledTableSegments(content: string): ParsedTableSegment[] {
  if (!content.includes("<table_title")) {
    return content ? [{ type: "markdown", content }] : [];
  }

  const segments: ParsedTableSegment[] = [];
  let cursor = 0;
  TABLE_TITLE_OPEN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TABLE_TITLE_OPEN_RE.exec(content)) !== null) {
    const before = content.slice(cursor, match.index);
    if (before) {
      segments.push({ type: "markdown", content: before });
    }

    const attrs = parseTagAttributes(match[1] ?? "");
    const title = attrs.title?.trim() || attrs.label?.trim() || "Table";

    let afterTag = match.index + match[0].length;
    const closeMatch = TABLE_TITLE_CLOSE_RE.exec(content.slice(afterTag));
    if (closeMatch) afterTag += closeMatch[0].length;

    const tableMatch = TABLE_BLOCK_RE.exec(content.slice(afterTag));
    const tableMarkdown = tableMatch?.[1] ?? "";

    segments.push({
      type: "titled_table",
      id: `table-${match.index}`,
      title,
      tableMarkdown,
    });

    cursor = afterTag + (tableMatch?.[0].length ?? 0);
    TABLE_TITLE_OPEN_RE.lastIndex = cursor;
  }

  const remaining = content.slice(cursor);
  if (remaining) {
    segments.push({ type: "markdown", content: remaining });
  }

  return segments;
}

export function hasTitledTable(content: string): boolean {
  return content.includes("<table_title");
}
