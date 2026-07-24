import type { HomerReasoningEffort } from "@/lib/model-effort";

export type NovitaOpenAiProviderMode = "plain" | "web" | "thinking";

/** @deprecated Legacy AI SDK provider options — kept for compatibility. */
export function buildNovitaOpenAiProviderOptions(input: {
  conversationId?: string;
  homerReasoningEffort?: HomerReasoningEffort;
  mode: NovitaOpenAiProviderMode;
}) {
  const openai: {
    reasoningEffort?: "high" | "max";
    parallelToolCalls?: boolean;
    forceReasoning?: boolean;
  } = {};

  if (input.mode === "thinking") {
    openai.reasoningEffort = input.homerReasoningEffort ?? "high";
    openai.forceReasoning = true;
    openai.parallelToolCalls = true;
  }

  if (input.mode === "web") {
    openai.parallelToolCalls = true;
  }

  return {
    openai,
    generation: {
      temperature: 0.6,
      maxOutputTokens: 8192,
    },
  };
}
