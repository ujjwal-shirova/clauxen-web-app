import { parseTagAttributes } from "@/lib/create-file-tags";

export type ParsedTableSegment =
  | { type: "markdown"; content: string }
  | { type: "titled_table"; id: string; title: string; tableMarkdown: string };

const TABLE_TITLE_OPEN_RE = /<table_title\b([^>]*)>/gi;
const TABLE_TITLE_CLOSE_RE = /^\s*<\/table_title>/i;
function extractTableBlock(text: string): { length: number; tableMarkdown: string } {
  const lines = text.split("\n");
  let i = 0;
  let charCount = 0;
  // skip leading blank/whitespace lines
  while (i < lines.length && lines[i].trim() === "") {
    charCount += lines[i].length + 1; // +1 for \n
    i++;
  }
  const tableLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("|")) {
      tableLines.push(line);
      charCount += line.length + 1;
      i++;
    } else {
      break;
    }
  }
  if (tableLines.length === 0) {
    return { length: 0, tableMarkdown: "" };
  }
  return {
    length: Math.min(charCount, text.length),
    tableMarkdown: tableLines.join("\n"),
  };
}

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

    const tableBlock = extractTableBlock(content.slice(afterTag));
    const tableMarkdown = tableBlock.tableMarkdown;

    segments.push({
      type: "titled_table",
      id: `table-${match.index}`,
      title,
      tableMarkdown,
    });

    cursor = afterTag + tableBlock.length;
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
