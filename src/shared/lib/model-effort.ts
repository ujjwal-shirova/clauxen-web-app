import type { ConfiguredModelId } from "@/lib/model-config";

/** OpenAI reasoning effort exposed by the product UI. */
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

export type OpenAIReasoningParams = {
  enabled: boolean;
  effort?: HomerReasoningEffort;
};

/**
 * Build OpenAI Responses reasoning controls.
 * Composer Thinking toggle maps here: On → true, Off → false.
 */
export function resolveOpenAIReasoningParams(input: {
  chatModel: ConfiguredModelId;
  thinkingEnabled: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
}): OpenAIReasoningParams {
  const enabled = input.thinkingEnabled === true;
  if (!enabled) {
    return { enabled: false };
  }
  if (input.chatModel === "homer") {
    return {
      enabled: true,
      effort:
        input.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT,
    };
  }
  return { enabled: true };
}

/**
 * Resolve thinking controls for the autonomous agent.
 *
 * User preference (composer Thinking On|Off) is authoritative and defaults
 * off. Capable models only receive extended thinking when the user opts in.
 * The Homer effort dial (high/max) remains the quality knob when On.
 */
export function resolveAutonomousThinkingParams(input: {
  chatModel: ConfiguredModelId;
  thinkingEnabled?: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
}): OpenAIReasoningParams {
  return resolveOpenAIReasoningParams({
    chatModel: input.chatModel,
    thinkingEnabled: input.thinkingEnabled === true,
    homerReasoningEffort: input.homerReasoningEffort,
  });
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
