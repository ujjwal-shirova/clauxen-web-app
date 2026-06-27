import type { ConfiguredModelId } from "@/lib/model-config";

/** Homer (GLM-5.2) reasoning effort — Novita accepts "high" | "max". */
export type HomerReasoningEffort = "high" | "max";

export const DEFAULT_HOMER_REASONING_EFFORT: HomerReasoningEffort = "high";

export const HOMER_REASONING_EFFORT_OPTIONS: ReadonlyArray<{
  value: HomerReasoningEffort;
  label: string;
}> = [
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

export function isHomerReasoningEffort(
  value: unknown,
): value is HomerReasoningEffort {
  return value === "high" || value === "max";
}

export function parseHomerReasoningEffort(
  value: unknown,
): HomerReasoningEffort {
  return isHomerReasoningEffort(value) ? value : DEFAULT_HOMER_REASONING_EFFORT;
}

export function getHomerReasoningEffortOption(effort: HomerReasoningEffort) {
  return (
    HOMER_REASONING_EFFORT_OPTIONS.find((option) => option.value === effort) ??
    HOMER_REASONING_EFFORT_OPTIONS[0]
  );
}

export type NovitaThinkingParams = {
  enable_thinking: boolean;
  reasoning_effort?: HomerReasoningEffort;
};

/**
 * Build Novita thinking controls for chat/completions.
 * Always sets enable_thinking explicitly so models do not think by default.
 */
export function resolveNovitaThinkingParams(input: {
  chatModel: ConfiguredModelId;
  thinkingEnabled: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
}): NovitaThinkingParams {
  const enable_thinking = input.thinkingEnabled === true;
  if (!enable_thinking) {
    return { enable_thinking: false };
  }
  if (input.chatModel === "homer") {
    return {
      enable_thinking: true,
      reasoning_effort:
        input.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT,
    };
  }
  return { enable_thinking: true };
}

/**
 * Resolve thinking controls for the single autonomous agent.
 *
 * Thinking is a model capability, NOT a user-selected mode. Capable models
 * (legacy Homer/Helios and current Virgil) reason automatically on every turn — the model itself
 * decides how deeply to think based on the task. Other models stream plain
 * completions. The Homer effort dial (high/max) is the single quality knob.
 */
export function resolveAutonomousThinkingParams(input: {
  chatModel: ConfiguredModelId;
  homerReasoningEffort?: HomerReasoningEffort;
}): NovitaThinkingParams {
  const supportsThinking =
    input.chatModel === "homer" ||
    input.chatModel === "helios" ||
    input.chatModel === "virgil";
  if (!supportsThinking) return { enable_thinking: false };
  if (input.chatModel === "homer") {
    return {
      enable_thinking: true,
      reasoning_effort:
        input.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT,
    };
  }
  return { enable_thinking: true };
}

/** @deprecated Legacy effort type — no longer shown in UI. */
export type ModelEffort = "low" | "medium" | "high" | "xhigh";

/** @deprecated */
export const DEFAULT_MODEL_EFFORT: ModelEffort = "medium";

/** @deprecated */
export function parseModelEffort(value: unknown): ModelEffort {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  ) {
    return value;
  }
  return DEFAULT_MODEL_EFFORT;
}
