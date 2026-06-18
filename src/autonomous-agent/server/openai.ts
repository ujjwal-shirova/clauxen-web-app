import { getOpenAIClient } from "@/backend/inference/openai-client";
import { autonomousAgentConfig } from "@/autonomous-agent/server/config";

/** OpenAI SDK client via Novita-compatible base URL (shared with main chat). */
export function getAutonomousAgentOpenAI(baseUrl?: string) {
  return getOpenAIClient(baseUrl ?? autonomousAgentConfig.defaultBaseUrl);
}
