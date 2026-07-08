/**
 * Compatibility re-exports — the canonical implementations now live in:
 *   - @/backend/inference/agent-engine (autonomous agent loop)
 *   - @/backend/inference/novita-client (raw Novita streaming)
 *   - @/backend/inference/clauxen-sse-stream (SSE protocol)
 */

import { runAutonomousAgent, type AgentStreamOptions } from "@/backend/inference/agent-engine";
import { ClauxenSseStream } from "@/backend/inference/clauxen-sse-stream";
import type { IncomingMessage } from "@/backend/inference/novita";
import { buildModelSystemPrompt } from "@/backend/inference/system-prompt";
import { resolveModelRuntime, parseChatModelId, modelCatalogEnvFromProcess } from "@/lib/model-catalog";
import {
  parseHomerReasoningEffort,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

export type ChatStreamOptions = {
  chatModel?: string;
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
  signal?: AbortSignal;
};

/** Use runAutonomousAgent from agent-engine directly for new code. */
export function createChatStream(
  messages: IncomingMessage[],
  options: ChatStreamOptions = {},
): ReadableStream<Uint8Array> {
  const catalogEnv = modelCatalogEnvFromProcess();
  const chatModelId = parseChatModelId(options.chatModel);
  const runtime = resolveModelRuntime(chatModelId, catalogEnv);
  const systemPrompt = buildModelSystemPrompt({ model: chatModelId });

  const sse = new ClauxenSseStream();

  const agentOptions: AgentStreamOptions = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    model: runtime.modelSlug,
    chatModelId,
    homerReasoningEffort: parseHomerReasoningEffort(options.homerReasoningEffort),
    userId: options.userId,
    conversationId: options.conversationId,
    userCountryCode: options.userCountryCode,
    signal: options.signal,
    systemPrompt,
    temperature: 0.6,
    maxTokens: 8192,
  };

  // Always autonomous — tools are always armed; the model decides when to use them.
  void runAutonomousAgent(sse, agentOptions);

  return sse.stream;
}

/** @deprecated Use runAutonomousAgent from agent-engine directly. */
export const streamNovitaChat = createChatStream;
export const streamAiSdkChat = createChatStream;
