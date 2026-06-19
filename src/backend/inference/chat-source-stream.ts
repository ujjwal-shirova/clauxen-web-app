import type { IncomingMessage, ThinkingType } from "@/backend/inference/novita";
import { trimIncomingMessagesForApi } from "@/backend/inference/chat-context";
import { streamAiSdkChat } from "@/backend/inference/ai-sdk-chat-stream";
import { streamOpenAiChat } from "@/backend/inference/openai-stream";
import { resolveInferenceRoute } from "@/lib/inference-routing";
import { parseChatModelId } from "@/lib/model-catalog";

export type ChatSourceStreamOptions = {
  chatModel?: string;
  thinkingType?: ThinkingType;
  userId?: string;
  conversationId?: string;
  webSearchEnabled?: boolean;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  signal?: AbortSignal;
};

/** Build the byte stream for a chat turn.
 *  Plain chat (no tools, no thinking, no web) uses the lightest direct OpenAI streaming path
 *  so tokens arrive and render with minimal server-side overhead.
 */
export async function createChatSourceStream(
  messages: IncomingMessage[],
  options: ChatSourceStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const thinkingType = options.thinkingType ?? "disabled";
  const webSearchEnabled = options.webSearchEnabled === true;
  const chatModel = parseChatModelId(options.chatModel);
  const route = resolveInferenceRoute({
    chatModel,
    thinkingType,
    webSearchEnabled,
  });

  const trimmedMessages = trimIncomingMessagesForApi(messages);
  const isPlain =
    thinkingType === "disabled" && !webSearchEnabled && !options.generateChatTitle;

  if (isPlain) {
    // Fastest path: raw OpenAI-compatible stream → UI message events.
    return streamOpenAiChat(trimmedMessages, options.signal, {
      thinkingType,
      generateChatTitle: false,
      model: route.modelSlug,
      baseUrl: route.baseUrl,
    });
  }

  return streamAiSdkChat(trimmedMessages, options.signal, {
    model: route.modelSlug,
    baseUrl: route.baseUrl,
    thinkingType,
    userId: options.userId,
    conversationId: options.conversationId,
    webSearchEnabled,
    userCountryCode: options.userCountryCode,
    generateChatTitle: options.generateChatTitle,
  });
}
