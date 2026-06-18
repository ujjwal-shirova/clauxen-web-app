import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { autonomousAgentTools } from "@/backend/inference/autonomous-tools/definitions";

export function autonomousToolsToOpenAi(): ChatCompletionTool[] {
  return autonomousAgentTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}
