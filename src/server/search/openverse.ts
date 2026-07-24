/**
 * Openverse — free, keyless search over openly-licensed (Creative Commons /
 * public domain) images. No Google, no paid tier, no API key required.
 * https://api.openverse.org/v1/
 */

const SEARCH_URL = "https://api.openverse.org/v1/images/";

export type ImageResult = {
  url: string;
  thumbnail: string;
  alt: string;
  landingUrl: string;
  creator?: string;
  license?: string;
};

type OpenverseRow = {
  title?: string;
  url: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
};

export async function searchImages(
  query: string,
  count = 3,
): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(Math.max(1, count), 10)),
    license_type: "all-cc",
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { "User-Agent": "ClauxenAgent/1.0 (https://clauxen.app)" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: OpenverseRow[] };
  return (data.results ?? []).map((row) => ({
    url: row.url,
    thumbnail: row.thumbnail || row.url,
    alt: row.title || query,
    landingUrl: row.foreign_landing_url || row.url,
    creator: row.creator,
    license: row.license,
  }));
}
