import { marked } from "marked";
type Block = {
  kind: "heading" | "paragraph" | "code" | "quote" | "list" | "table";
  text: string;
  markdown?: string;
  depth?: number;
  rows?: string[][];
};
function plain(text: string): string {
  return researchInline(text)
    .map((segment) =>
      segment.link ? `${segment.text} (${segment.link})` : segment.text,
    )
    .join("");
}
export function researchExportBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const token of marked.lexer(markdown)) {
    switch (token.type) {
      case "heading":
        blocks.push({
          kind: "heading",
          text: plain(token.text),
          markdown: token.text,
          depth: token.depth,
        });
        break;
      case "paragraph":
      case "text":
        blocks.push({
          kind: "paragraph",
          text: plain(token.text),
          markdown: token.text,
        });
        break;
      case "code":
        blocks.push({ kind: "code", text: token.text });
        break;
      case "blockquote":
        blocks.push({ kind: "quote", text: plain(token.text) });
        break;
      case "list":
        token.items.forEach((item: { text: string }, index: number) =>
          blocks.push({
            kind: "list",
            text: `${token.ordered ? `${index + Number(token.start || 1)}.` : "•"} ${plain(item.text)}`,
          }),
        );
        break;
      case "table":
        blocks.push({
          kind: "table",
          text: "",
          rows: [
            token.header.map((cell: { text: string }) => plain(cell.text)),
            ...token.rows.map((row: { text: string }[]) =>
              row.map((cell: { text: string }) => plain(cell.text)),
            ),
          ],
        });
        break;
      default:
        break;
    }
  }
  return blocks;
}
type Inline = { text: string; bold?: boolean; italic?: boolean; link?: string };
export function researchInline(markdown: string, literal = false): Inline[] {
  if (literal) return [{ text: markdown }];
  const result: Inline[] = [];
  const visit = (input: string, style: Omit<Inline, "text"> = {}) => {
    for (const token of marked.Lexer.lexInline(input)) {
      if (token.type === "strong") visit(token.text, { ...style, bold: true });
      else if (token.type === "em")
        visit(token.text, { ...style, italic: true });
      else if (token.type === "link")
        visit(token.text, {
          ...style,
          link: /^https?:/i.test(token.href) ? token.href : undefined,
        });
      else if (token.type === "br") result.push({ ...style, text: "\n" });
      else
        result.push({
          ...style,
          text:
            token.type === "html"
              ? token.raw.replace(/<[^>]*>/g, "")
              : "text" in token
                ? token.text
                : token.raw,
        });
    }
  };
  visit(markdown);
  return result;
}
