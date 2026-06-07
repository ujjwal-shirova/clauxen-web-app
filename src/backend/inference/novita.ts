import { env, requireNovitaApiKey } from "@/backend/config/env";
import {
  buildTitlePromptPayload,
  deriveTitleFromExchange,
  normalizeChatTitle,
  type TitleExchange,
} from "@/lib/chat-title";

export type ChatRole = "user" | "assistant" | "system";
export type IncomingMessage = { role: ChatRole; content: string };

export type ThinkingType = "enabled" | "disabled";

export function resolveThinkingType(input?: {
  thinkingEnabled?: boolean;
  thinkingType?: string;
}): ThinkingType {
  if (input?.thinkingEnabled === false) return "disabled";
  if (input?.thinkingEnabled === true) return "enabled";
  if (input?.thinkingType === "disabled" || input?.thinkingType === "enabled") {
    return input.thinkingType;
  }
  return env.thinkingType;
}

export type ChatStreamEvent =
  | { type: "start" }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string }
  | { type: "answer_delta"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function encodeSseEvent(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function sanitizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((message: unknown): message is IncomingMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as { role?: unknown; content?: unknown };
      return (
        typeof candidate.role === "string" &&
        typeof candidate.content === "string" &&
        ["user", "assistant", "system"].includes(candidate.role)
      );
    })
    .map((message) => ({ role: message.role, content: message.content }));
}

function novitaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function extractUpstreamError(body: unknown, fallback: string) {
  const candidate = body as {
    error?: { message?: unknown } | string;
    message?: unknown;
  };

  if (typeof candidate?.error === "string") return candidate.error;
  if (
    candidate?.error &&
    typeof candidate.error === "object" &&
    typeof candidate.error.message === "string"
  ) {
    return candidate.error.message;
  }
  if (typeof candidate?.message === "string") return candidate.message;
  return fallback;
}

export type NovitaChatRequestOptions = {
  stream?: boolean;
  thinkingType?: ThinkingType;
  maxTokens?: number;
};

/** Request body for Novita OpenAI-compatible chat (Kimi K2.6). */
export function buildNovitaChatBody(
  messages: IncomingMessage[],
  options: NovitaChatRequestOptions = {},
) {
  const stream = options.stream ?? true;
  const thinkingType = options.thinkingType ?? env.thinkingType;
  const hasSystem = messages.some((message) => message.role === "system");
  const fullMessages = hasSystem
    ? messages
    : [{ role: "system" as const, content: "Be a helpful assistant." }, ...messages];

  return {
    model: env.defaultModel,
    messages: fullMessages,
    stream,
    response_format: { type: "text" as const },
    max_tokens: options.maxTokens ?? 131072,
    temperature: 1,
    top_p: 1,
    min_p: 0,
    top_k: 50,
    presence_penalty: 0,
    frequency_penalty: 0,
    repetition_penalty: 1,
    enable_thinking: thinkingType === "enabled",
    separate_reasoning: true,
  };
}

export async function streamNovitaChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: Pick<NovitaChatRequestOptions, "thinkingType">,
) {
  const apiKey = requireNovitaApiKey();
  const upstream = await fetch(env.novitaChatUrl, {
    method: "POST",
    headers: novitaHeaders(apiKey),
    signal,
    body: JSON.stringify(
      buildNovitaChatBody(messages, {
        stream: true,
        thinkingType: options?.thinkingType,
      }),
    ),
  });

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.json().catch(() => null);
    throw new Error(extractUpstreamError(body, "Novita chat request failed."));
  }

  return upstream;
}

function titleExchangeFromMessages(messages: IncomingMessage[]): TitleExchange {
  return {
    userContent: messages.find((message) => message.role === "user")?.content ?? "",
    assistantContent:
      messages.find((message) => message.role === "assistant")?.content ?? "",
  };
}

export function deriveTitleFallback(messages: IncomingMessage[]): string {
  const exchange = titleExchangeFromMessages(messages);
  return deriveTitleFromExchange(exchange.userContent, exchange.assistantContent);
}

export function sanitizeGeneratedTitle(raw: string, exchange: TitleExchange): string {
  return normalizeChatTitle(raw, exchange);
}

/** Title requests never use thinking/reasoning - answer text only. */
export function buildNovitaTitleBody(messages: IncomingMessage[]) {
  const exchange = titleExchangeFromMessages(messages);
  const titleMessages: IncomingMessage[] = [
    {
      role: "system",
      content: [
        "You write short conversation titles for a chat sidebar.",
        "Rules:",
        "- Output ONLY the title (3-6 words)",
        "- No quotes, markdown, labels, or explanation",
        "- Summarize the topic; do NOT copy the user's message verbatim",
        '- Example: User asks about React useEffect loops → "React useEffect loop fix"',
      ].join("\n"),
    },
    {
      role: "user",
      content: buildTitlePromptPayload(exchange),
    },
  ];

  return {
    model: env.defaultModel,
    messages: titleMessages,
    stream: false,
    max_tokens: 48,
    temperature: 0.3,
    enable_thinking: false,
    separate_reasoning: false,
  };
}

export async function generateNovitaTitle(messages: IncomingMessage[]) {
  const apiKey = requireNovitaApiKey();
  const exchange = titleExchangeFromMessages(messages);
  const fallbackTitle = deriveTitleFromExchange(
    exchange.userContent,
    exchange.assistantContent,
  );

  const upstream = await fetch(env.novitaChatUrl, {
    method: "POST",
    headers: novitaHeaders(apiKey),
    body: JSON.stringify(buildNovitaTitleBody(messages)),
  });

  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw new Error(extractUpstreamError(body, "Novita title request failed."));
  }

  const message = (
    body as {
      choices?: {
        message?: {
          content?: string | null;
          reasoning_content?: string | null;
        };
      }[];
    }
  )?.choices?.[0]?.message;

  const answer =
    message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (answer) {
    return sanitizeGeneratedTitle(answer, exchange);
  }

  return fallbackTitle;
}

export function transformNovitaStream(
  upstream: ReadableStream<Uint8Array>,
  onAnswerDelta: (delta: string) => void,
  onThinkingDelta: (delta: string) => void,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let thinking = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode(encodeSseEvent({ type: "start" })));
      const reader = upstream.getReader();

      const onAbort = () => {
        try {
          reader.cancel();
        } catch (_) {}
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          controller.close();
          return;
        }
        signal.addEventListener("abort", onAbort);
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            let parsed: {
              choices?: {
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  reasoning?: string;
                };
              }[];
            };

            try {
              parsed = JSON.parse(payload) as typeof parsed;
            } catch {
              continue;
            }

            const delta = parsed.choices?.[0]?.delta;
            const reasoning =
              delta?.reasoning_content ?? delta?.reasoning ?? "";
            const content = delta?.content ?? "";

            if (reasoning) {
              if (!thinking) {
                thinking = true;
                controller.enqueue(
                  new TextEncoder().encode(encodeSseEvent({ type: "thinking_start" })),
                );
              }
              onThinkingDelta(reasoning);
              controller.enqueue(
                new TextEncoder().encode(
                  encodeSseEvent({ type: "thinking_delta", delta: reasoning }),
                ),
              );
            }

            if (content) {
              onAnswerDelta(content);
              controller.enqueue(
                new TextEncoder().encode(
                  encodeSseEvent({ type: "answer_delta", delta: content }),
                ),
              );
            }
          }
        }

        controller.enqueue(new TextEncoder().encode(encodeSseEvent({ type: "done" })));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream failed.";
        controller.enqueue(
          new TextEncoder().encode(encodeSseEvent({ type: "error", message })),
        );
        controller.close();
      } finally {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    },
  });
}
