/** OpenAI Responses API provider surface for agent-core. */

export {
  streamOpenAIResponse,
  toOpenAITools,
  type OpenAIInputItem,
  type OpenAIOutputItem,
  type OpenAIMessageContent,
  type OpenAICompletionOptions,
  type OpenAIStreamPart,
  type OpenAIToolDefinition,
} from "@/server/inference/openai-responses-client";

export {
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
  env,
} from "@/server/config/env";
