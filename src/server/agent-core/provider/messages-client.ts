/**
 * Provider / Novita Messages client for agent-core.
 *
 * Only Provider_API_Key + derived Anthropic-compatible base URL.
 * No Anthropic OAuth, Bedrock, Vertex, or Foundry.
 */

export {
  streamAnthropicMessages,
  toAnthropicTools,
  type AnthropicChatMessage,
  type AnthropicCompletionOptions,
  type AnthropicStreamPart,
  type AnthropicToolDefinition,
} from "@/server/inference/anthropic-messages-client";

export {
  requireProviderApiKey,
  requireAnthropicBaseUrl,
  env,
} from "@/server/config/env";
