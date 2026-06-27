import OpenAI from "openai";
import { env, requireNovitaApiKey } from "@/backend/config/env";
import { novitaFetch } from "@/backend/inference/novita-fetch";

const clients = new Map<string, OpenAI>();

function normalizeOpenAiCompatBaseUrl(baseUrl?: string) {
  const normalized = (baseUrl ?? env.novitaOpenAiBaseUrl).replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

/** OpenAI SDK client for a Novita-compatible base URL (cached per URL). */
export function getOpenAIClient(baseUrl?: string) {
  const normalized = normalizeOpenAiCompatBaseUrl(baseUrl);
  const existing = clients.get(normalized);
  if (existing) return existing;

  const apiKey = requireNovitaApiKey();
  const client = new OpenAI({
    apiKey,
    baseURL: normalized,
    fetch: novitaFetch,
    maxRetries: 0,
  });
  clients.set(normalized, client);
  return client;
}

export const DEFAULT_MODEL = "moonshotai/kimi-k2.6";

export const AVAILABLE_MODELS = [
  {
    id: "zai-org/glm-5.2",
    name: "GLM-5.2",
    provider: "ZAI Org",
    context: 128000,
    features: [
      "function-calling",
      "structured-outputs",
      "vision",
      "streaming",
      "prompt-cache",
    ],
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "Moonshot AI",
    context: 128000,
    features: [
      "function-calling",
      "structured-outputs",
      "vision",
      "streaming",
      "prompt-cache",
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  provider: string;
  context: number;
  features: string[];
}>;

export function modelSupportsFeature(
  modelId: string,
  feature: string,
): boolean {
  const row = AVAILABLE_MODELS.find((m) => m.id === modelId);
  return (
    (row?.features as readonly string[] | undefined)?.includes(feature) ?? true
  );
}
