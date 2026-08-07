/** Project RAG embeddings via the OpenAI-compatible embeddings endpoint. */

const DEFAULT_EMBEDDING_MODEL = "baai/bge-m3";
/** Existing shared pgvector table uses vector(1536). */
const EMBEDDING_DIM = 1536;

function embeddingConfig() {
  const apiKey =
    process.env.EMBEDDING_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.Provider_API_Key?.trim() ||
    "";
  const baseUrl = (
    process.env.EMBEDDING_BASE_URL?.trim() ||
    process.env.Provider_BASE_URL?.trim() ||
    process.env.NOVITA_OPENAI_BASE_URL?.trim() ||
    "https://api.novita.ai/openai"
  ).replace(/\/+$/, "");
  const model = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  return { apiKey, baseUrl, model };
}

function embeddingEndpoint(baseUrl: string) {
  return /\/v1$/i.test(baseUrl)
    ? `${baseUrl}/embeddings`
    : `${baseUrl}/v1/embeddings`;
}

/** Pad smaller provider vectors so they fit the shared vector(1536) column. */
function normalizeEmbedding(vector: number[]) {
  if (vector.length > EMBEDDING_DIM) return vector.slice(0, EMBEDDING_DIM);
  if (vector.length === EMBEDDING_DIM) return vector;
  return [...vector, ...Array<number>(EMBEDDING_DIM - vector.length).fill(0)];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const { apiKey, baseUrl, model } = embeddingConfig();
  if (!apiKey) {
    throw new Error("No embedding provider API key is configured.");
  }

  const response = await fetch(embeddingEndpoint(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: "float",
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
    data?: Array<{ index?: number; embedding?: number[] }>;
  };
  const rows = [...(payload.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  if (
    rows.length !== texts.length ||
    rows.some((row) => !row.embedding?.length)
  ) {
    throw new Error("Invalid embedding response.");
  }
  return rows.map((row) => normalizeEmbedding(row.embedding!));
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  if (!vector) throw new Error("Invalid embedding response.");
  return vector;
}

export function vectorToSql(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export { EMBEDDING_DIM };
