import { MODEL_CONFIG } from "@/lib/model-config";
import {
  streamOpenAIResponse,
  type OpenAIInputItem,
} from "@/server/agent-core";
import { env } from "@/server/config/env";

export type StreamMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamOpenAIProjectResponse(options: {
  system?: string;
  messages: StreamMessage[];
  model?: string;
  thinkingLevel?: string;
  onToken: (token: string) => void;
}) {
  const model =
    options.model ??
    env.defaultModel ??
    MODEL_CONFIG.models.helios.defaultSlug;
  const input = options.messages.map(
    (message) =>
      ({
        role: message.role,
        content: message.content,
      }) as OpenAIInputItem,
  );

  let fullText = "";
  for await (const part of streamOpenAIResponse({
    model,
    instructions: options.system,
    input,
    reasoningEffort: options.thinkingLevel ? "medium" : undefined,
  })) {
    if (part.type === "text-delta") {
      fullText += part.delta;
      options.onToken(part.delta);
    }
    if (part.type === "error") throw new Error(part.error);
    if (part.type === "abort") throw new Error("Generation aborted.");
  }
  return fullText;
}
