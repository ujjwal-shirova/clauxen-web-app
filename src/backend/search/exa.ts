import Exa from "exa-js";
import { env } from "@/backend/config/env";

export type ExaSearchHit = {
  title: string;
  url: string;
  snippet: string;
  highlights?: string[];
};

function getExaClient(): Exa | null {
  const apiKey = env.exaApiKey;
  if (!apiKey) return null;
  return new Exa(apiKey);
}

/** Raw retrieval via Exa /search — type auto, highlights for token-efficient excerpts. */
export async function searchWebWithExa(query: string): Promise<ExaSearchHit[]> {
  const exa = getExaClient();
  if (!exa) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const response = await exa.search(query, {
    type: "auto",
    numResults: 10,
    contents: {
      highlights: true,
    },
  });

  return (response.results ?? []).map((result) => {
    const highlights = Array.isArray(result.highlights)
      ? result.highlights.filter((h): h is string => typeof h === "string")
      : undefined;
    const text =
      "text" in result && typeof result.text === "string" ? result.text : "";
    const snippet = highlights?.join(" ") || text.slice(0, 500);

    return {
      title: result.title ?? "",
      url: result.url ?? "",
      snippet: snippet.trim(),
      highlights,
    };
  });
}

/** Fetch page excerpts for known URLs via Exa /contents. */
export async function fetchUrlContentsWithExa(
  urls: string[],
): Promise<ExaSearchHit[]> {
  const exa = getExaClient();
  if (!exa) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const response = await exa.getContents(urls, { highlights: true });

  return (response.results ?? []).map((result) => {
    const highlights = Array.isArray(result.highlights)
      ? result.highlights.filter((h): h is string => typeof h === "string")
      : undefined;
    const text =
      "text" in result && typeof result.text === "string" ? result.text : "";
    const snippet = highlights?.join(" ") || text.slice(0, 8000);

    return {
      title: result.title ?? result.url ?? "",
      url: result.url ?? "",
      snippet: snippet.trim(),
      highlights,
    };
  });
}

export function isExaConfigured(): boolean {
  return Boolean(env.exaApiKey);
}
