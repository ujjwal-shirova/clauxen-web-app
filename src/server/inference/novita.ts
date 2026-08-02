import { tapUiMessageSseStream } from "@/server/inference/clauxen-ui-stream";
import {
  buildTitlePromptPayload,
  deriveTitleFromExchange,
  normalizeChatTitle,
  type TitleExchange,
} from "@/lib/chat-title";
import { stripMessageContentForModelApi } from "@/lib/model-context";

export type ChatRole = "user" | "assistant" | "system";
export type IncomingMessage = { role: ChatRole; content: string };

export type ThinkingType = "enabled" | "disabled";

export function resolveThinkingType(input?: {
  thinkingEnabled?: boolean;
  thinkingType?: string;
}): ThinkingType {
  if (input?.thinkingEnabled === true) return "enabled";
  if (input?.thinkingEnabled === false) return "disabled";
  if (input?.thinkingType === "enabled") return "enabled";
  return "disabled";
}

export type AgentSegmentKind = "thinking" | "narration" | "text" | "tool";

export type ChatStreamEvent =
  | { type: "start"; agentMode?: boolean }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string; segmentId?: string }
  | { type: "thinking_end"; segmentId?: string }
  | { type: "segment_start"; segmentId: string; kind: AgentSegmentKind }
  | { type: "segment_end"; segmentId: string; kind: AgentSegmentKind }
  | { type: "narration_delta"; delta: string; segmentId: string }
  | { type: "answer_delta"; delta: string; segmentId?: string }
  | {
      type: "tool_start";
      toolCallId: string;
      name: string;
      args?: Record<string, unknown>;
      description?: string;
    }
  | {
      type: "tool_output_delta";
      toolCallId: string;
      kind: "stdout" | "stderr";
      delta: string;
    }
  | { type: "tool_data"; toolCallId: string; data: Record<string, unknown> }
  | {
      type: "tool_end";
      toolCallId: string;
      name: string;
      result: string;
      isError?: boolean;
    }
  | { type: "step_done"; label?: string }
  | {
      type: "artifact_upsert";
      artifactId: string;
      path: string;
      content: string;
      language?: string;
      description?: string;
      fileId?: string;
      storagePath?: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  | { type: "agent_frame_start"; frameId: string }
  | { type: "agent_frame_complete"; frameId?: string }
  | { type: "answer_finalize"; segmentId?: string; text: string }
  | { type: "chat_title"; title: string }
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
    .map((message) => ({
      role: message.role,
      content: stripMessageContentForModelApi(message.content),
    }));
}

export function extractUpstreamError(body: unknown, fallback: string) {
  const candidate = body as {
    error?: { message?: unknown; type?: unknown } | string;
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

function titleExchangeFromMessages(messages: IncomingMessage[]): TitleExchange {
  return {
    userContent:
      messages.find((message) => message.role === "user")?.content ?? "",
    assistantContent:
      messages.find((message) => message.role === "assistant")?.content ?? "",
  };
}

export function deriveTitleFallback(messages: IncomingMessage[]): string {
  const exchange = titleExchangeFromMessages(messages);
  return deriveTitleFromExchange(
    exchange.userContent,
    exchange.assistantContent,
  );
}

export function sanitizeGeneratedTitle(
  raw: string,
  exchange: TitleExchange,
): string {
  return normalizeChatTitle(raw, exchange);
}

/** Pass-through for agent/chat SSE while tapping answer/thinking/tools for persistence. */
export function tapChatSseStream(
  source: ReadableStream<Uint8Array>,
  callbacks: {
    onAnswerDelta?: (delta: string) => void;
    onAnswerFinalize?: (text: string) => void;
    onAnswerClear?: () => void;
    onThinkingStart?: () => void;
    onThinkingDelta?: (delta: string) => void;
    onThinkingEnd?: () => void;
    onChatTitle?: (title: string) => void;
    onToolStart?: (tool: {
      toolCallId: string;
      name: string;
      args?: Record<string, unknown>;
      description?: string;
    }) => void;
    onToolEnd?: (tool: {
      toolCallId: string;
      name: string;
      result: string;
      isError?: boolean;
    }) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  return tapUiMessageSseStream(source, callbacks, signal);
}

export { buildTitlePromptPayload };
