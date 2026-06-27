import type { IncomingMessage } from "@/backend/inference/novita";
import { createChatStream } from "@/app/api/chat/stream";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import type { ReadableStream } from "stream/web";

export type ThinkingAgentStreamOptions = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  homerReasoningEffort?: HomerReasoningEffort;
};

/**
 * @deprecated Use createChatStream from @/app/api/chat/stream directly.
 */
export function streamThinkingAgentChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: ThinkingAgentStreamOptions = {},
): ReadableStream<Uint8Array> {
  return createChatStream(messages, {
    userId: options.userId,
    conversationId: options.conversationId,
    userCountryCode: options.userCountryCode,
    homerReasoningEffort: options.homerReasoningEffort,
    signal,
  });
}
