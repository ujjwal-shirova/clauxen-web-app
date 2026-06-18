import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/backend/config/env";

/** Novita OpenAI-compatible provider for Vercel AI SDK (`/v1/chat/completions`). */
export function createNovitaProvider(baseUrl?: string) {
  const apiKey = env.novitaApiKey;
  if (!apiKey) {
    throw new Error("NOVITA_API_KEY is not configured.");
  }

  return createOpenAI({
    apiKey,
    baseURL: `${(baseUrl ?? env.novitaOpenAiBaseUrl).replace(/\/+$/, "")}/v1`,
  });
}

/** Chat-completions model handle — required for Novita (not Responses API). */
export function novitaChatModel(modelSlug: string, baseUrl?: string) {
  return createNovitaProvider(baseUrl).chat(modelSlug);
}
