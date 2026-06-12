import Anthropic from "@anthropic-ai/sdk";
import { env, requireNovitaApiKey } from "@/backend/config/env";

let client: Anthropic | null = null;

/** Singleton Anthropic SDK client for Novita (`https://api.novita.ai/anthropic`). */
export function getAnthropicClient() {
  if (!client) {
    const apiKey = requireNovitaApiKey();
    client = new Anthropic({
      apiKey,
      baseURL: env.novitaAnthropicBaseUrl,
      defaultHeaders: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }
  return client;
}

export const DEFAULT_MODEL = env.defaultModel;

export const AVAILABLE_MODELS = [
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
  {
    id: "deepseek/deepseek_v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    context: 64000,
    features: [
      "function-calling",
      "structured-outputs",
      "streaming",
      "prompt-cache",
    ],
  },
  {
    id: "qwen/qwen2.5-vl-72b-instruct",
    name: "Qwen 2.5 VL 72B",
    provider: "Alibaba",
    context: 32000,
    features: ["vision", "streaming"],
  },
  {
    id: "minimax/minimax-m2",
    name: "MiniMax M2",
    provider: "MiniMax",
    context: 1000000,
    features: [
      "function-calling",
      "streaming",
      "reasoning",
      "interleaved-thinking",
    ],
  },
  {
    id: "mistralai/mistral-7b-instruct",
    name: "Mistral 7B",
    provider: "Mistral",
    context: 32000,
    features: ["structured-outputs", "streaming"],
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
