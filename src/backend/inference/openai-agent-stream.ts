import type { IncomingMessage, ThinkingType } from "@/backend/inference/novita";
import { streamAiSdkChat } from "@/backend/inference/ai-sdk-chat-stream";

/**
 * @deprecated Use streamAiSdkChat from ai-sdk-chat-stream.ts
 */
export function streamOpenAiAgentChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    thinkingType?: ThinkingType;
    userId?: string;
    conversationId?: string;
    webSearchEnabled?: boolean;
    userCountryCode?: string;
    generateChatTitle?: boolean;
    model?: string;
    baseUrl?: string;
  },
): ReadableStream<Uint8Array> {
  return streamAiSdkChat(messages, signal, options);
}
