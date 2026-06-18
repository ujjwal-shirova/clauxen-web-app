import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  openaiClient ??= new OpenAI({ apiKey });
  return openaiClient;
}

export async function embedText(text: string): Promise<number[]> {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIM,
  });
  const vector = response.data[0]?.embedding;
  if (!vector || vector.length !== EMBEDDING_DIM) {
    throw new Error("Invalid embedding response from OpenAI.");
  }
  return vector;
}

export function vectorToSql(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export { EMBEDDING_DIM };
