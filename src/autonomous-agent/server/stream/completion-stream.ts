import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { parse as parsePartialJson, Allow } from "partial-json";
import type { EventSink } from "@/autonomous-agent/server/stream/run-turn";
import type { PendingToolCall } from "@/autonomous-agent/server/stream/normalizer";
import { stamp } from "@/autonomous-agent/types/events";

const THINK_OPEN = "<" + "think" + ">";
const THINK_CLOSE = "<" + "/" + "think" + ">";

export type CompletionStreamState = {
  thinkOpen: boolean;
  reasoningSeq: number;
  reasoningOpen: boolean;
  messageSeq: number;
  textMessageStarted: boolean;
  textMessageId: string;
  assistantContent: string;
  pendingByIndex: Map<number, PendingToolCall>;
  startedToolIds: Set<string>;
};

export function createCompletionStreamState(): CompletionStreamState {
  return {
    thinkOpen: false,
    reasoningSeq: 0,
    reasoningOpen: false,
    messageSeq: 0,
    textMessageStarted: false,
    textMessageId: "",
    assistantContent: "",
    pendingByIndex: new Map(),
    startedToolIds: new Set(),
  };
}

export function parseToolArgs(buffer: string): Record<string, unknown> {
  try {
    return JSON.parse(buffer) as Record<string, unknown>;
  } catch {
    try {
      return parsePartialJson(buffer, Allow.ALL) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function splitThinkFromAnswer(chunk: string, inThink: { value: boolean }) {
  let reasoning = "";
  let answer = "";
  let remaining = chunk;

  while (remaining.length > 0) {
    if (inThink.value) {
      const closeIdx = remaining.indexOf(THINK_CLOSE);
      if (closeIdx === -1) {
        reasoning += remaining;
        remaining = "";
      } else {
        reasoning += remaining.slice(0, closeIdx);
        remaining = remaining.slice(closeIdx + THINK_CLOSE.length);
        inThink.value = false;
      }
      continue;
    }

    const openIdx = remaining.indexOf(THINK_OPEN);
    if (openIdx === -1) {
      answer += remaining;
      remaining = "";
    } else {
      answer += remaining.slice(0, openIdx);
      remaining = remaining.slice(openIdx + THINK_OPEN.length);
      inThink.value = true;
    }
  }

  return { reasoning, answer };
}

function ensureTextMessageStart(
  state: CompletionStreamState,
  sink: EventSink,
): string {
  if (!state.textMessageStarted) {
    state.textMessageId = `msg-${state.messageSeq++}`;
    state.textMessageStarted = true;
    sink.send(
      stamp({
        type: "TextMessageStart",
        messageId: state.textMessageId,
        role: "assistant",
      }),
    );
  }
  return state.textMessageId;
}

function closeReasoningIfOpen(state: CompletionStreamState, sink: EventSink) {
  if (!state.reasoningOpen) return;
  sink.send(
    stamp({
      type: "ReasoningEnd",
      messageId: `reasoning-${state.reasoningSeq}`,
    }),
  );
  state.reasoningOpen = false;
  state.reasoningSeq += 1;
}

/**
 * Process one Chat Completions stream chunk into normalized events.
 */
export function processCompletionChunk(
  chunk: ChatCompletionChunk,
  state: CompletionStreamState,
  sink: EventSink,
): void {
  const delta = chunk.choices[0]?.delta;
  if (!delta) return;

  const thinkState = { value: state.thinkOpen };

  if (delta.content) {
    state.assistantContent += delta.content;
    const split = splitThinkFromAnswer(delta.content, thinkState);
    state.thinkOpen = thinkState.value;

    if (split.reasoning) {
      if (!state.reasoningOpen) {
        state.reasoningOpen = true;
        sink.send(
          stamp({
            type: "ReasoningStart",
            messageId: `reasoning-${state.reasoningSeq}`,
          }),
        );
      }
      sink.send(
        stamp({
          type: "ReasoningMessageContent",
          messageId: `reasoning-${state.reasoningSeq}`,
          delta: split.reasoning,
        }),
      );
    }

    if (split.answer) {
      closeReasoningIfOpen(state, sink);
      const messageId = ensureTextMessageStart(state, sink);
      sink.send(
        stamp({
          type: "TextMessageContent",
          messageId,
          delta: split.answer,
        }),
      );
    }
  }

  if (delta.tool_calls) {
    for (const toolDelta of delta.tool_calls) {
      const index = toolDelta.index ?? 0;
      const current = state.pendingByIndex.get(index) ?? {
        id: toolDelta.id ?? "",
        name: toolDelta.function?.name ?? "",
        argsBuffer: "",
      };
      if (toolDelta.id) current.id = toolDelta.id;
      if (toolDelta.function?.name) current.name = toolDelta.function.name;
      if (toolDelta.function?.arguments) {
        current.argsBuffer += toolDelta.function.arguments;
      }
      state.pendingByIndex.set(index, current);

      if (current.id && current.name && !state.startedToolIds.has(current.id)) {
        state.startedToolIds.add(current.id);
        closeReasoningIfOpen(state, sink);
        sink.send(
          stamp({
            type: "ToolCallStart",
            toolCallId: current.id,
            toolCallName: current.name,
          }),
        );
      }

      if (current.id && toolDelta.function?.arguments) {
        const preview = parseToolArgs(current.argsBuffer);
        sink.send(
          stamp({
            type: "ToolCallArgs",
            toolCallId: current.id,
            delta: toolDelta.function.arguments,
            preview,
          }),
        );
      }
    }
  }
}

/** Finalize open reasoning/text segments after the stream ends. */
export function finalizeCompletionStream(
  state: CompletionStreamState,
  sink: EventSink,
): PendingToolCall[] {
  closeReasoningIfOpen(state, sink);

  if (state.textMessageStarted) {
    sink.send(
      stamp({
        type: "TextMessageEnd",
        messageId: state.textMessageId,
      }),
    );
    state.textMessageStarted = false;
  }

  return [...state.pendingByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call)
    .filter((call) => call.id && call.name);
}

export function buildAssistantToolCallMessage(
  state: CompletionStreamState,
  toolCalls: PendingToolCall[],
): ChatCompletionMessageParam {
  return {
    role: "assistant",
    content: state.assistantContent || null,
    tool_calls: toolCalls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.name,
        arguments: call.argsBuffer,
      },
    })),
  };
}
