/**
 * Project RAG embeddings via raw HTTP (no OpenAI SDK).
 *
 * Anthropic Messages does not expose an embeddings API. Project ingestion still
 * needs vectors, so this uses a configurable OpenAI-compatible embeddings
 * endpoint when EMBEDDING_API_KEY / OPENAI_API_KEY is set.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

function embeddingConfig() {
  const apiKey =
    process.env.EMBEDDING_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const baseUrl = (
    process.env.EMBEDDING_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

export async function embedText(text: string): Promise<number[]> {
  const { apiKey, baseUrl } = embeddingConfig();
  if (!apiKey) {
    throw new Error(
      "EMBEDDING_API_KEY (or OPENAI_API_KEY) is not configured for project embeddings.",
    );
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIM,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Embedding request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = payload.data?.[0]?.embedding;
  if (!vector || vector.length !== EMBEDDING_DIM) {
    throw new Error("Invalid embedding response.");
  }
  return vector;
}

export function vectorToSql(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export { EMBEDDING_DIM };
