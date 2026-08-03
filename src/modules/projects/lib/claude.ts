import Anthropic from "@anthropic-ai/sdk";
import {
  env,
  requireProviderApiKey,
  requireAnthropicBaseUrl,
} from "@/server/config/env";
import { MODEL_CONFIG } from "@/lib/model-config";

const DEFAULT_MODEL = MODEL_CONFIG.models.helios.defaultSlug;

let anthropicClient: Anthropic | null = null;

function getAnthropic() {
  anthropicClient ??= new Anthropic({
    apiKey: requireProviderApiKey(),
    baseURL: requireAnthropicBaseUrl(),
  });
  return anthropicClient;
}

export type StreamMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamClaudeResponse(options: {
  system?: string;
  messages: StreamMessage[];
  model?: string;
  thinkingLevel?: string;
  onToken: (token: string) => void;
}) {
  const client = getAnthropic();
  const model = options.model ?? env.defaultModel ?? DEFAULT_MODEL;

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    ...(options.system ? { system: options.system } : {}),
    messages: options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  let fullText = "";
  stream.on("text", (delta) => {
    fullText += delta;
    options.onToken(delta);
  });

  await stream.finalMessage();
  return fullText;
}
