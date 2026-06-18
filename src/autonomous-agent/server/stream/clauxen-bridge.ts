import type { ClauxenUiStreamWriter } from "@/backend/inference/clauxen-ui-stream-writer";
import { toolLabelForUi } from "@/autonomous-agent/server/logic/tool-steering";
import type { NormalizedEvent } from "@/autonomous-agent/types/events";
import type { EventSink } from "@/autonomous-agent/server/stream/run-turn";

type BridgeState = {
  toolArgsBuffer: Map<string, string>;
  toolNames: Map<string, string>;
  frameCounter: number;
  workFrameOpen: boolean;
  aborted: boolean;
};

function nextFrameId(state: BridgeState): string {
  state.frameCounter += 1;
  return `frame-${state.frameCounter}`;
}

function emitWebSearchData(
  bridge: ClauxenUiStreamWriter,
  toolCallId: string,
  content: unknown,
) {
  if (!content || typeof content !== "object") return;
  const record = content as {
    query?: string;
    results?: Array<{ title?: string; url?: string; snippet?: string }>;
  };
  if (!Array.isArray(record.results)) return;
  bridge.onToolData({
    tool_call_id: toolCallId,
    query: record.query,
    results: record.results,
  });
}

function emitWebFetchData(
  bridge: ClauxenUiStreamWriter,
  toolCallId: string,
  content: unknown,
) {
  if (!content || typeof content !== "object") return;
  const record = content as { url?: string; title?: string; snippet?: string };
  if (!record.url) return;
  bridge.onToolData({
    tool_call_id: toolCallId,
    url: record.url,
    title: record.title,
    snippet: record.snippet,
  });
}

function emitFileArtifact(
  bridge: ClauxenUiStreamWriter,
  content: unknown,
) {
  if (!content || typeof content !== "object") return;
  const record = content as { path?: string; content?: string; bytesWritten?: number };
  if (!record.path) return;
  bridge.onArtifact({
    path: record.path,
    content:
      typeof record.content === "string"
        ? record.content
        : `Wrote ${record.bytesWritten ?? 0} bytes`,
  });
}

/**
 * Maps normalized autonomous-agent events into the Clauxen UI message stream
 * consumed by the main chat thread / agent orchestration view.
 */
export function createClauxenEventSink(
  bridge: ClauxenUiStreamWriter,
  signal?: AbortSignal,
): EventSink {
  const state: BridgeState = {
    toolArgsBuffer: new Map(),
    toolNames: new Map(),
    frameCounter: 0,
    workFrameOpen: false,
    aborted: false,
  };

  if (signal) {
    if (signal.aborted) state.aborted = true;
    signal.addEventListener("abort", () => {
      state.aborted = true;
    });
  }

  return {
    isOpen() {
      return !state.aborted;
    },
    send(event: NormalizedEvent) {
      if (state.aborted) return;

      switch (event.type) {
        case "RunStarted":
          return;

        case "ReasoningStart":
          return;

        case "ReasoningMessageContent":
          bridge.onReasoningDelta(event.delta);
          return;

        case "ReasoningEnd":
          return;

        case "TextMessageStart":
          return;

        case "TextMessageContent":
          bridge.onAnswerDelta(event.delta);
          return;

        case "TextMessageEnd":
          return;

        case "ToolCallStart":
          if (!state.workFrameOpen) {
            bridge.onFrameStart(nextFrameId(state));
            state.workFrameOpen = true;
          }
          state.toolNames.set(event.toolCallId, event.toolCallName);
          state.toolArgsBuffer.set(event.toolCallId, "");
          bridge.onToolExecuting({
            tool_call_id: event.toolCallId,
            name: event.toolCallName,
            description: toolLabelForUi(event.toolCallName),
            args: {},
          });
          return;

        case "ToolCallArgs": {
          const name =
            state.toolNames.get(event.toolCallId) ?? event.toolCallId;
          const prior = state.toolArgsBuffer.get(event.toolCallId) ?? "";
          const next = prior + event.delta;
          state.toolArgsBuffer.set(event.toolCallId, next);
          bridge.onToolStreaming({
            tool_calls: [{ id: event.toolCallId, name, input: next }],
          });
          return;
        }

        case "ToolCallProgress":
          bridge.onToolData({
            tool_call_id: event.toolCallId,
            ...event.data,
          });
          return;

        case "ToolCallEnd":
          return;

        case "ToolCallResult": {
          const name =
            state.toolNames.get(event.toolCallId) ??
            bridge.toolNameFor(event.toolCallId) ??
            "tool";
          const result =
            typeof event.content === "string"
              ? event.content
              : JSON.stringify(event.content ?? {});

          if (name === "web_search") {
            emitWebSearchData(bridge, event.toolCallId, event.content);
          }
          if (name === "web_fetch") {
            emitWebFetchData(bridge, event.toolCallId, event.content);
          }
          if (name === "file_write") {
            emitFileArtifact(bridge, event.content);
          }

          bridge.onToolResult({
            tool_call_id: event.toolCallId,
            name,
            result,
          });
          return;
        }

        case "StepDone":
          bridge.onStepDone(event.label);
          return;

        case "ClarificationRequested":
          bridge.onAnswerDelta(
            `\n\n**Clarification needed:** ${event.question}\n`,
          );
          return;

        case "RunFinished":
          if (state.workFrameOpen) {
            bridge.onFrameComplete();
            state.workFrameOpen = false;
          }
          state.toolArgsBuffer.clear();
          state.toolNames.clear();
          return;

        case "RunError":
          bridge.onError(event.message);
          return;

        default:
          return;
      }
    },
  };
}
