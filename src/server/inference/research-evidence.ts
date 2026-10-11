import type { OpenAIInputItem } from "./openai-responses-client";

const SEARCH_EXCERPT_CHARS = 1800;
const FETCH_EXCERPT_CHARS = 8000;
const EVIDENCE_CHARS = 140_000;

/** Search providers may return entire pages as highlights. Never duplicate
 * those pages in every model round, tool journal and UI transcript. */
export function researchToolOutput(name: string, output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  const data = output as Record<string, unknown>;
  if (data.error) return output;
  if (name === "web_search" && Array.isArray(data.results)) {
    return {
      query: data.query,
      searchType: data.searchType,
      results: data.results.slice(0, 30).map((raw, index) => {
        const hit = raw as Record<string, unknown>;
        const text = [
          hit.snippet,
          ...(Array.isArray(hit.highlights) ? hit.highlights : []),
        ].filter(
          (value): value is string =>
            typeof value === "string" && !!value.trim(),
        );
        // Highlights often contain the exact same text as the snippet.
        const excerpt = [...new Set(text)].join("\n");
        return {
          index: index + 1,
          title: String(hit.title ?? "").slice(0, 200),
          url: hit.url,
          publishedDate: hit.publishedDate,
          snippet: excerpt.slice(0, SEARCH_EXCERPT_CHARS),
          ...(excerpt.length > SEARCH_EXCERPT_CHARS
            ? { excerptTruncated: true }
            : {}),
        };
      }),
      note: "Search excerpts are evidence previews. Use web_fetch for full details before making claims.",
    };
  }
  if (name === "web_fetch" && typeof data.snippet === "string") {
    return {
      ...data,
      snippet: data.snippet.slice(0, FETCH_EXCERPT_CHARS),
      ...(data.snippet.length > FETCH_EXCERPT_CHARS
        ? { excerptTruncated: true }
        : {}),
    };
  }
  return output;
}

/** Preserve every source URL and tool call/output pair while budgeting excerpts
 * across a long research run. Also repairs oversized pre-fix checkpoints. */
export function budgetResearchEvidence(conversation: OpenAIInputItem[]) {
  const names = new Map<string, string>();
  for (const item of conversation)
    if (item.role === "assistant") {
      for (const call of item.tool_calls ?? [])
        if (call.type === "function") names.set(call.id, call.function.name);
    }
  const evidence: Array<{
    item: Extract<OpenAIInputItem, { role: "tool" }>;
    data: Record<string, unknown>;
  }> = [];
  let characters = 0;
  for (const item of conversation) {
    if (item.role !== "tool" || typeof item.content !== "string") continue;
    const name = names.get(item.tool_call_id);
    if (name !== "web_search" && name !== "web_fetch") continue;
    try {
      const data = researchToolOutput(name, JSON.parse(item.content)) as Record<
        string,
        unknown
      >;
      if (!data || typeof data !== "object") continue;
      const hits = Array.isArray(data.results) ? data.results : [data];
      for (const hit of hits)
        characters += typeof hit.snippet === "string" ? hit.snippet.length : 0;
      evidence.push({ item, data });
    } catch {
      /* Non-JSON errors remain available to the model. */
    }
  }
  const ratio = Math.min(1, EVIDENCE_CHARS / Math.max(1, characters));
  for (const { item, data } of evidence) {
    if (ratio < 1)
      for (const hit of Array.isArray(data.results) ? data.results : [data]) {
        if (typeof hit.snippet !== "string") continue;
        hit.snippet = hit.snippet.slice(
          0,
          Math.floor(hit.snippet.length * ratio),
        );
        hit.excerptTruncated = true;
      }
    item.content = JSON.stringify(data);
  }
}

export function retryableResearchProviderError(error: string) {
  return /\b429\b|\b5\d\d\b|overloaded|capacity|timeout|timed out|stopped responding|deadline|ECONNRESET|ETIMEDOUT|connection error/i.test(
    error,
  );
}
