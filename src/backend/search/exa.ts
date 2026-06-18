import Exa from "exa-js";
import { env } from "@/backend/config/env";

export type ExaSearchHit = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  highlights?: string[];
};

export type ExaSearchOptions = {
  /** ISO 3166-1 alpha-2 country code — biases ranking toward the user's region. */
  userLocation?: string;
  /** Partial synthesized stream text from Exa SSE (OpenAI-style chunks). */
  onStreamContent?: (delta: string) => void;
  /** Fires as citation hits arrive during streaming. */
  onPartialResults?: (results: ExaSearchHit[]) => void;
};

type ExaResultRow = {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  highlights?: string[] | null;
  text?: string;
};

type ExaCitationRow = {
  url?: string;
  title?: string;
  publishedDate?: string;
  text?: string;
};

const SEARCH_TYPE = "fast" as const;
const NUM_RESULTS = 10;

function getExaClient(): Exa | null {
  const apiKey = env.exaApiKey;
  if (!apiKey) return null;
  return new Exa(apiKey);
}

function buildSearchRequestOptions(userLocation?: string) {
  return {
    type: SEARCH_TYPE,
    numResults: NUM_RESULTS,
    moderation: true,
    ...(userLocation ? { userLocation } : {}),
    contents: {
      highlights: true as const,
    },
  };
}

function mapExaResult(result: ExaResultRow): ExaSearchHit {
  const highlights = Array.isArray(result.highlights)
    ? result.highlights.filter((h): h is string => typeof h === "string")
    : undefined;
  const text = typeof result.text === "string" ? result.text : "";
  const snippet = highlights?.join(" ") || text.slice(0, 500);

  return {
    title: result.title ?? "",
    url: result.url ?? "",
    snippet: snippet.trim(),
    publishedDate: result.publishedDate ?? undefined,
    highlights,
  };
}

async function emitResultsProgressively(
  results: ExaSearchHit[],
  onPartialResults?: (results: ExaSearchHit[]) => void,
) {
  if (!onPartialResults || results.length === 0) return;
  for (let count = 1; count <= results.length; count += 1) {
    onPartialResults(results.slice(0, count));
    if (count < results.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }
}

function mapCitation(citation: ExaCitationRow): ExaSearchHit {
  const text = typeof citation.text === "string" ? citation.text : "";
  return {
    title: citation.title ?? citation.url ?? "",
    url: citation.url ?? "",
    snippet: text.slice(0, 500).trim(),
    publishedDate: citation.publishedDate,
    highlights: text ? [text] : undefined,
  };
}

/**
 * Semantic web search via Exa `/search`:
 * - `type: "fast"` for low-latency agent turns
 * - `streamSearch` (stream: true) for live citation/SSE updates
 * - non-stream fallback when streaming yields no citations
 * - `userLocation` for localized result ranking
 */
export async function searchWebWithExa(
  query: string,
  options?: ExaSearchOptions,
): Promise<ExaSearchHit[]> {
  const exa = getExaClient();
  if (!exa) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const requestOptions = buildSearchRequestOptions(options?.userLocation);
  const hitsByUrl = new Map<string, ExaSearchHit>();

  try {
    for await (const chunk of exa.streamSearch(query, requestOptions)) {
      if (chunk.content) {
        options?.onStreamContent?.(chunk.content);
      }

      if (chunk.citations?.length) {
        for (const citation of chunk.citations) {
          if (!citation.url || hitsByUrl.has(citation.url)) continue;
          hitsByUrl.set(citation.url, mapCitation(citation));
        }
        options?.onPartialResults?.(Array.from(hitsByUrl.values()));
      }
    }
  } catch {
    // Fall through to blocking search below.
  }

  if (hitsByUrl.size > 0) {
    return Array.from(hitsByUrl.values());
  }

  const response = await exa.search(query, requestOptions);
  const results = (response.results ?? []).map((result) =>
    mapExaResult(result as ExaResultRow),
  );
  await emitResultsProgressively(results, options?.onPartialResults);
  return results;
}

/** Fetch page excerpts for known URLs via Exa `/contents`. */
export async function fetchUrlContentsWithExa(
  urls: string[],
  textMaxCharacters = 8000,
): Promise<ExaSearchHit[]> {
  const exa = getExaClient();
  if (!exa) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const response = await exa.getContents(urls, {
    text: { maxCharacters: textMaxCharacters },
    highlights: true,
  });

  return (response.results ?? []).map((result) => {
    const mapped = mapExaResult(result as ExaResultRow);
    if (!mapped.snippet && mapped.highlights?.length) {
      mapped.snippet = mapped.highlights.join(" ").slice(0, 8000);
    }
    return mapped;
  });
}

export function isExaConfigured(): boolean {
  return Boolean(env.exaApiKey);
}
