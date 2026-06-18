import { parse as parsePartialJson, Allow } from "partial-json";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { NormalizedEvent } from "@/autonomous-agent/types/events";
import { stamp } from "@/autonomous-agent/types/events";

export type PendingToolCall = {
  id: string;
  name: string;
  argsBuffer: string;
};

export type StreamNormalizerState = {
  pendingToolCalls: Map<string, PendingToolCall>;
  finishedWithToolCalls: boolean;
  finalResponseId: string | null;
};

export function createNormalizerState(): StreamNormalizerState {
  return {
    pendingToolCalls: new Map(),
    finishedWithToolCalls: false,
    finalResponseId: null,
  };
}

export function normalizeStreamEvent(
  event: ResponseStreamEvent,
  state: StreamNormalizerState,
  conversationId: string,
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  switch (event.type) {
    case "response.created":
      events.push(
        stamp({
          type: "RunStarted",
          runId: event.response.id,
          conversationId,
        }),
      );
      break;

    case "response.output_item.added":
      if (event.item.type === "message") {
        events.push(
          stamp({
            type: "TextMessageStart",
            messageId: event.item.id,
            role: "assistant",
          }),
        );
      } else if (event.item.type === "function_call") {
        const callId = event.item.id ?? event.item.call_id;
        if (!callId || !event.item.name) break;
        state.pendingToolCalls.set(callId, {
          id: callId,
          name: event.item.name,
          argsBuffer: event.item.arguments ?? "",
        });
        events.push(
          stamp({
            type: "ToolCallStart",
            toolCallId: callId,
            toolCallName: event.item.name,
          }),
        );
      } else if (event.item.type === "reasoning") {
        events.push(
          stamp({
            type: "ReasoningStart",
            messageId: event.item.id,
          }),
        );
      }
      break;

    case "response.output_text.delta":
      if (event.delta) {
        events.push(
          stamp({
            type: "TextMessageContent",
            messageId: event.item_id,
            delta: event.delta,
          }),
        );
      }
      break;

    case "response.reasoning_summary_text.delta":
      if (event.delta) {
        events.push(
          stamp({
            type: "ReasoningMessageContent",
            messageId: event.item_id,
            delta: event.delta,
          }),
        );
      }
      break;

    case "response.function_call_arguments.delta": {
      const call = state.pendingToolCalls.get(event.item_id);
      if (call) {
        call.argsBuffer += event.delta;
        let preview: Record<string, unknown> = {};
        try {
          preview = parsePartialJson(call.argsBuffer, Allow.ALL) as Record<
            string,
            unknown
          >;
        } catch {
          // Fragment not parseable yet — skip preview for this frame.
        }
        events.push(
          stamp({
            type: "ToolCallArgs",
            toolCallId: event.item_id,
            delta: event.delta,
            preview,
          }),
        );
      }
      break;
    }

    case "response.output_item.done":
      if (event.item.type === "message") {
        events.push(
          stamp({
            type: "TextMessageEnd",
            messageId: event.item.id,
          }),
        );
      } else if (event.item.type === "function_call") {
        state.finishedWithToolCalls = true;
        const callId = event.item.id ?? event.item.call_id;
        if (!callId) break;
        const existing = state.pendingToolCalls.get(callId);
        if (existing) {
          existing.argsBuffer = event.item.arguments ?? existing.argsBuffer;
        }
        events.push(
          stamp({
            type: "ToolCallEnd",
            toolCallId: callId,
          }),
        );
      } else if (event.item.type === "reasoning") {
        events.push(
          stamp({
            type: "ReasoningEnd",
            messageId: event.item.id,
          }),
        );
      }
      break;

    case "response.completed":
      state.finalResponseId = event.response.id;
      break;

    case "error":
      events.push(
        stamp({
          type: "RunError",
          conversationId,
          message: event.message,
          runId: state.finalResponseId ?? undefined,
        }),
      );
      break;

    default:
      break;
  }

  return events;
}

export function parseToolCallArgs(argsBuffer: string): Record<string, unknown> {
  try {
    return JSON.parse(argsBuffer) as Record<string, unknown>;
  } catch {
    return {};
  }
}
