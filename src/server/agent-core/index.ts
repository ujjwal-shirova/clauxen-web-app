/**
 * @/server/agent-core — Provider-only agent runtime for Clauxen chat.
 *
 * Import from here in generate / stream routes. Do not import legacy-source/.
 */

export {
  runAgent,
  runAutonomousAgent,
  generateChatTitle,
  type AgentStreamOptions,
} from "@/server/agent-core/runtime/run-agent";

export { productionDeps, type QueryDeps } from "@/server/agent-core/query/deps";

export {
  streamOpenAIResponse,
  toOpenAITools,
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
  type OpenAIInputItem,
  type OpenAIOutputItem,
  type OpenAIMessageContent,
  type OpenAICompletionOptions,
  type OpenAIStreamPart,
  type OpenAIToolDefinition,
} from "@/server/agent-core/provider/messages-client";

export {
  autonomousAgentTools,
  executeAutonomousTool,
} from "@/server/agent-core/tools";
