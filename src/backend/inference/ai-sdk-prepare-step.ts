import type { ToolSet } from "ai";

export type AgentCapabilityMode = "plain" | "web" | "thinking";

export function resolveAgentCapabilityMode(input: {
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
}): AgentCapabilityMode {
  if (input.thinkingEnabled) return "thinking";
  if (input.webSearchEnabled) return "web";
  return "plain";
}

/**
 * Native deferred tools via AI SDK `prepareStep` + `activeTools`.
 * Step 0 omits tool schemas unless extended thinking is on; the model decides on later steps.
 */
export function buildAgentPrepareStep<TOOLS extends ToolSet>(
  mode: AgentCapabilityMode,
  toolNames: Array<keyof TOOLS & string>,
) {
  return ({
    stepNumber: _stepNumber,
    steps: _steps,
  }: {
    stepNumber: number;
    steps: ReadonlyArray<{ toolCalls: ReadonlyArray<unknown> }>;
  }) => {
    if (mode === "plain" || toolNames.length === 0) {
      return { activeTools: [] as Array<keyof TOOLS & string> };
    }

    if (mode === "thinking") {
      return {};
    }

    // Web: compact web-only toolkit; model decides whether to call (not forced every turn).
    if (mode === "web") {
      return { activeTools: toolNames };
    }

    return { activeTools: [] as Array<keyof TOOLS & string> };
  };
}
