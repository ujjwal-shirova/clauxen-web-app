import type { IncomingMessage } from "@/backend/inference/novita";
import { completeChat, type ChatMessage } from "@/backend/inference/novita-client";
import { createChatStream } from "@/app/api/chat/stream";
import { buildTitleGenerationSystemPrompt } from "@/backend/inference/system-prompt";
import { modelCatalogEnvFromProcess } from "@/lib/model-catalog";

/**
 * @deprecated Use createChatStream from @/app/api/chat/stream directly.
 * Thin wrapper kept for legacy imports.
 */
export async function streamOpenAiChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    generateChatTitle?: boolean;
    chatModel?: "homer" | "helios" | "virgil";
  },
): Promise<ReadableStream<Uint8Array>> {
  return createChatStream(messages, {
    generateChatTitle: options?.generateChatTitle,
    chatModel: options?.chatModel,
    signal,
  });
}

/** Short, non-streaming title generation via the custom Novita client. */
export async function generateOpenAiTitle(
  messages: IncomingMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const userContent =
    messages.find((m) => m.role === "user")?.content?.trim() ?? "";
  const assistantContent =
    messages.find((m) => m.role === "assistant")?.content?.trim() ?? "";

  const titleMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildTitleGenerationSystemPrompt(),
    },
    {
      role: "user",
      content: [
        userContent ? `User: ${userContent}` : "",
        assistantContent ? `Assistant: ${assistantContent}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const text = await completeChat({
    model: modelCatalogEnvFromProcess().heliosModel,
    messages: titleMessages,
    temperature: 0.3,
    max_tokens: 48,
    signal,
  });

  return text.trim();
}
