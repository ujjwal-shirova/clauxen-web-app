import Exa from "exa-js";
import { env, requireExaApiKey } from "@/server/config/env";

export type ExaSearchHit = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  favicon?: string;
  highlights?: string[];
};

export type ExaSearchOptions = {
  /** ISO 3166-1 alpha-2 country code — biases ranking toward the user's region. */
  userLocation?: string;
  /** Partial synthesized stream text from Exa SSE (OpenAI-style chunks). */
  onStreamContent?: (delta: string) => void;
  /** Fires as citation hits arrive during streaming. */
  onPartialResults?: (results: ExaSearchHit[]) => void;
  /** Number of results to request (1-100). */
  numResults?: number;
  /** JSON schema for structured synthesis (output.content). */
  outputSchema?: Record<string, unknown>;
  /** Additional system instructions for quality, safety, and behavior. */
  systemPrompt?: string;
};

type ExaResultRow = {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  favicon?: string | null;
  highlights?: string[] | null;
  text?: string;
};

type ExaCitationRow = {
  url?: string;
  title?: string;
  publishedDate?: string;
  text?: string;
};

const SEARCH_TYPE = "auto" as const;
const NUM_RESULTS = 10;

import { EXA_SEARCH_SYSTEM_PROMPT } from "@/server/inference/system-prompt";

function getExaClient(): Exa | null {
  const apiKey = env.exaApiKey;
  if (!apiKey) return null;
  return new Exa(apiKey);
}

function requireExaClient(): Exa {
  return new Exa(requireExaApiKey());
}

function buildSearchRequestOptions(options?: {
  userLocation?: string;
  numResults?: number;
  outputSchema?: Record<string, unknown>;
  systemPrompt?: string;
}) {
  const num = Math.max(1, Math.min(100, options?.numResults ?? NUM_RESULTS));
  const sys = options?.systemPrompt || EXA_SEARCH_SYSTEM_PROMPT;
  const base: any = {
    type: SEARCH_TYPE,
    numResults: num,
    moderation: true,
    systemPrompt: sys,
    contents: {
      highlights: true as const,
    },
  };
  if (options?.userLocation) base.userLocation = options.userLocation;
  if (options?.outputSchema) base.outputSchema = options.outputSchema;
  return base;
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
    favicon: result.favicon ?? undefined,
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
        setTimeout(resolve, 80);
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
 * - `type: "auto"` for balanced source quality and latency
 * - `streamSearch` (stream: true) for live citation/SSE updates
 * - non-stream fallback when streaming yields no citations
 * - `userLocation` for localized result ranking
 */
export async function searchWebWithExa(
  query: string,
  options?: ExaSearchOptions,
): Promise<ExaSearchHit[]> {
  const exa = requireExaClient();

  const requestOptions = buildSearchRequestOptions({
    userLocation: options?.userLocation,
    numResults: options?.numResults,
    outputSchema: options?.outputSchema,
    systemPrompt: options?.systemPrompt,
  });
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
          options?.onPartialResults?.(Array.from(hitsByUrl.values()));
        }
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
  const exa = requireExaClient();

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
