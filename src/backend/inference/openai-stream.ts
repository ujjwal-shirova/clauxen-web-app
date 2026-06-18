import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  createClauxenUiMessageStream,
  encodeUiMessageStreamToBytes,
} from "@/backend/inference/clauxen-ui-stream";
import { env } from "@/backend/config/env";
import { getOpenAIClient } from "@/backend/inference/openai-client";
import { NOVITA_STREAM_OPTIONS } from "@/backend/inference/novita-stream";
import type { IncomingMessage, ThinkingType } from "@/backend/inference/novita";
import {
  ChatTitleStreamFilter,
  flushChatTitleFilterTail,
  buildInlineChatTitleSystemInstruction,
} from "@/lib/chat-title";

const DEFAULT_CHAT_MAX_TOKENS = 8192;

function toOpenAiMessages(
  messages: IncomingMessage[],
  options?: { generateChatTitle?: boolean },
): ChatCompletionMessageParam[] {
  const systemParts: string[] = [
    "You are Clauxen, a helpful AI assistant. Answer clearly and concisely.",
  ];
  if (options?.generateChatTitle) {
    systemParts.push(buildInlineChatTitleSystemInstruction());
  }

  const out: ChatCompletionMessageParam[] = [
    { role: "system", content: systemParts.join("\n\n") },
  ];

  for (const message of messages) {
    if (message.role === "system") {
      out.push({ role: "system", content: message.content });
    } else if (message.role === "user") {
      out.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      out.push({ role: "assistant", content: message.content });
    }
  }

  return out;
}

/**
 * Fast-path chat streaming via Novita's OpenAI-compatible API.
 * Used for simple conversations without tools or extended thinking.
 */
export function streamOpenAiChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    thinkingType?: ThinkingType;
    generateChatTitle?: boolean;
    model?: string;
    baseUrl?: string;
  },
): ReadableStream<Uint8Array> {
  const model = options?.model?.trim() || env.heliosModel;
  const baseUrl = options?.baseUrl ?? env.novitaOpenAiBaseUrl;
  const thinkingEnabled = (options?.thinkingType ?? "disabled") === "enabled";

  const uiStream = createClauxenUiMessageStream(async (bridge) => {
    bridge.writeStart(false);

    const titleFilter = options?.generateChatTitle
      ? new ChatTitleStreamFilter((title) => {
          bridge.onChatTitle(title);
        })
      : null;

    const client = getOpenAIClient(baseUrl);
    const openAiMessages = toOpenAiMessages(messages, {
      generateChatTitle: options?.generateChatTitle,
    });

    try {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: openAiMessages,
          max_tokens: DEFAULT_CHAT_MAX_TOKENS,
          temperature: thinkingEnabled ? 1 : 0.6,
          ...NOVITA_STREAM_OPTIONS,
        },
        { signal },
      );

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content;
        if (!delta) continue;

        const visible = titleFilter ? titleFilter.push(delta) : delta;
        if (visible) bridge.onAnswerDelta(visible);
      }

      const tail = flushChatTitleFilterTail(titleFilter);
      if (tail) bridge.onAnswerDelta(tail);
      bridge.finalize();
    } catch (error) {
      if (signal?.aborted) {
        bridge.finalize();
        return;
      }
      const message =
        error instanceof Error ? error.message : "Stream failed.";
      bridge.onError(message);
      bridge.finalize();
    }
  });

  return encodeUiMessageStreamToBytes(uiStream);
}

/** Short, non-streaming title generation via OpenAI for lower latency. */
export async function generateOpenAiTitle(
  messages: IncomingMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const client = getOpenAIClient();
  const userContent =
    messages.find((m) => m.role === "user")?.content?.trim() ?? "";
  const assistantContent =
    messages.find((m) => m.role === "assistant")?.content?.trim() ?? "";

  const response = await client.chat.completions.create(
    {
      model: env.heliosModel,
      max_tokens: 48,
      temperature: 0.3,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            "You write short conversation titles for a chat sidebar.",
            "Output ONLY the title (3-6 words). No quotes or labels.",
          ].join("\n"),
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
      ],
    },
    { signal },
  );

  return response.choices[0]?.message?.content?.trim() ?? "";
}
