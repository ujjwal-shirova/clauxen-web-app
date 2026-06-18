import type { IncomingMessage, ThinkingType } from "@/backend/inference/novita";
import { streamAiSdkChat } from "@/backend/inference/ai-sdk-chat-stream";

/** Unified chat/agent stream (Novita + AI SDK / thinking agent). */
export function streamChatAgent(
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

/** @deprecated Use streamChatAgent */
export const streamChatWithWebSearch = streamChatAgent;
