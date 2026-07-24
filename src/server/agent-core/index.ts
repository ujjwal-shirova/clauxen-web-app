/**
 * @/server/agent-core — Provider-only agent runtime for Clauxen chat.
 *
 * Import from here in generate / stream routes. Do not import legacy-source/.
 */

export {
  runAgent,
  runAutonomousAgent,
  type AgentStreamOptions,
} from "@/server/agent-core/runtime/run-agent";

export {
  streamAnthropicMessages,
  toAnthropicTools,
  requireProviderApiKey,
  requireAnthropicBaseUrl,
  type AnthropicChatMessage,
  type AnthropicCompletionOptions,
  type AnthropicStreamPart,
  type AnthropicToolDefinition,
} from "@/server/agent-core/provider/messages-client";

export {
  autonomousAgentTools,
  executeAutonomousTool,
} from "@/server/agent-core/tools";
