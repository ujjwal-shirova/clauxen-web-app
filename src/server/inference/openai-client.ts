import OpenAI from "openai";
import {
  env,
  requireProviderApiKey,
  requireProviderBaseUrl,
} from "@/server/config/env";
import { novitaFetch } from "@/server/inference/novita-fetch";

const clients = new Map<string, OpenAI>();

function normalizeOpenAiCompatBaseUrl(baseUrl?: string) {
  const raw = (baseUrl?.trim() || requireProviderBaseUrl()).replace(/\/+$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

/** OpenAI SDK client for the Provider_* OpenAI-compatible base URL (cached per URL). */
export function getOpenAIClient(baseUrl?: string) {
  const normalized = normalizeOpenAiCompatBaseUrl(baseUrl);
  const existing = clients.get(normalized);
  if (existing) return existing;

  const apiKey = requireProviderApiKey();
  const client = new OpenAI({
    apiKey,
    baseURL: normalized,
    fetch: novitaFetch,
    maxRetries: 0,
  });
  clients.set(normalized, client);
  return client;
}

/** Upstream model slug — prefer Provider_Model_Clauxen_V1 via env.defaultModel. */
export const DEFAULT_MODEL = env.defaultModel;

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
