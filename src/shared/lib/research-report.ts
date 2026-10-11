import { marked } from "marked";
export type ResearchCitation = { url: string; title: string; snippet?: string };
export type ResearchReport = {
  title: string;
  markdown: string;
  citations: ResearchCitation[];
  elapsedSeconds: number;
  fileName: string;
  fileId: string;
};
export function reportMarkdown(content: string, sources: ResearchCitation[]) {
  const fence = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i.exec(
    content,
  );
  const raw = fence?.[1] ?? content;
  return raw
    .replace(
      /\[([^\]\n]+)\]\[(\d+)\]|\[(\d+)\](?![:(])/g,
      (match, title, index, bare) => {
        const key = String(title ?? "").toLowerCase();
        const source =
          (key
            ? sources.find(
                (s) =>
                  s.title.toLowerCase() === key ||
                  s.url.toLowerCase().includes(key),
              )
            : undefined) ?? sources[Number(index ?? bare) - 1];
        return source ? `[${title ?? source.title}](${source.url})` : match;
      },
    )
    .trim();
}
export function reportCitations(
  markdown: string,
  sources: ResearchCitation[],
): ResearchCitation[] {
  const unique = new Map<string, ResearchCitation>();
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type !== "link") return;
    try {
      const url = new URL(token.href);
      if (!["https:", "http:"].includes(url.protocol)) return;
      url.hash = "";
      const key = url.toString();
      if (unique.has(key)) return;
      const found = sources.find((s) => {
        try {
          const source = new URL(s.url);
          source.hash = "";
          return source.toString() === key;
        } catch {
          return false;
        }
      });
      unique.set(key, {
        url: key,
        title: found?.title || token.text || url.hostname,
        snippet: found?.snippet,
      });
    } catch {
      /* Invalid URLs are not citations. */
    }
  });
  return [...unique.values()];
}
export function researchReportTitle(markdown: string, fallback: string) {
  const heading = marked
    .lexer(markdown)
    .find((token) => token.type === "heading" && token.depth === 1);
  return heading?.type === "heading"
    ? heading.text.replace(/[*_`]/g, "").slice(0, 200)
    : fallback;
}
