import { searchWebWithExa } from "@/backend/search/exa";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOptions = {
  userLocation?: string;
  toolCallId?: string;
  onPartialResults?: (results: WebSearchResult[]) => void;
};

export async function runWebSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<{
  query: string;
  results: WebSearchResult[];
}> {
  const hits = await searchWebWithExa(query, {
    userLocation: options.userLocation,
    onPartialResults: (partial) => {
      options.onPartialResults?.(
        partial.slice(0, 8).map((h) => ({
          title: h.title,
          url: h.url,
          snippet: h.snippet,
        })),
      );
    },
  });
  return {
    query,
    results: hits.slice(0, 8).map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet,
    })),
  };
}
