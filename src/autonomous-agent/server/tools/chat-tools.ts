import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { autonomousAgentTools } from "@/autonomous-agent/server/tools/definitions";

export type ToolSurface = "none" | "full";

export type AgentToolsRequest = {
  iteration: number;
  thinkingEnabled?: boolean;
};

/** Chat Completions tool format for Novita OpenAI-compatible API. */
export function toChatCompletionTools(surface: ToolSurface): ChatCompletionTool[] {
  if (surface === "none") return [];

  return autonomousAgentTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? undefined,
      parameters: tool.parameters ?? undefined,
    },
  }));
}

/**
 * Attach full tool schemas only when extended thinking is enabled (explicit agent mode),
 * or when the loop is continuing after tool results in the same turn.
 */
export function resolveToolsForAgentRequest(
  request: AgentToolsRequest,
): ChatCompletionTool[] | undefined {
  if (!request.thinkingEnabled && request.iteration === 0) {
    return undefined;
  }

  if (request.thinkingEnabled || request.iteration > 0) {
    const tools = toChatCompletionTools("full");
    return tools.length > 0 ? tools : undefined;
  }

  return undefined;
}
