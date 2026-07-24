import type { IncomingMessage } from "@/server/inference/novita";
import { createChatStream } from "@/app/api/chat/stream";
import type { HomerReasoningEffort } from "@/lib/model-effort";

export type ThinkingAgentStreamOptions = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  homerReasoningEffort?: HomerReasoningEffort;
};

/**
 * @deprecated Use createChatStream from @/app/api/chat/stream directly.
 */
export async function streamThinkingAgentChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: ThinkingAgentStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  return createChatStream(messages, {
    userId: options.userId,
    conversationId: options.conversationId,
    userCountryCode: options.userCountryCode,
    homerReasoningEffort: options.homerReasoningEffort,
    signal,
  });
}
