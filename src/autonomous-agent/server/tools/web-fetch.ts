import { fetchUrlContentsWithExa } from "@/backend/search/exa";

export async function runWebFetch(url: string): Promise<{
  url: string;
  title: string;
  snippet: string;
}> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("url is required");
  }

  try {
    const [hit] = await fetchUrlContentsWithExa([trimmed]);
    if (hit?.snippet) {
      return {
        url: hit.url,
        title: hit.title,
        snippet: hit.snippet,
      };
    }
  } catch {
    // fall through to direct fetch
  }

  const response = await fetch(trimmed, {
    headers: { "User-Agent": "Clauxen-Agent/1.0" },
  });
  const text = await response.text();
  const stripped = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    url: trimmed,
    title: trimmed,
    snippet: stripped.slice(0, 8000),
  };
}
