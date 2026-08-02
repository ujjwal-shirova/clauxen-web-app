import type { StreamEvent } from "@/lib/chat-stream";
import { createSseParser } from "@/lib/chat-stream";

/** Preliminary bash stdout/stderr frame carried on tool-output-available. */
type ClauxenToolStreamOutput = {
  clauxenStream: "stdout" | "stderr";
  delta: string;
};

/** Custom data-* payload shapes the legacy UI-message adapter understands. */
type ClauxenUIDataParts = {
  "agent-mode": { enabled: boolean };
  artifact: {
    artifactId: string;
    path: string;
    content: string;
    language?: string;
    description?: string;
    fileId?: string;
    storagePath?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  "tool-data": { toolCallId: string; data: Record<string, unknown> };
  "step-done": { label?: string };
  "agent-frame": { complete: boolean; frameId?: string };
  "agent-interim": { text: string };
  "chat-title": { title: string };
  "answer-clear": Record<string, never>;
};

/**
 * Minimal local replacement for the Vercel AI SDK's `UIMessageChunk` type.
 * Only the chunk variants we actually consume are listed here.
 */
type UIMessageChunk =
  | { type: "start" }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; delta: string }
  | { type: "reasoning-end"; id: string }
  | { type: "text-delta"; delta: string }
  | {
      type: "tool-input-start";
      toolCallId: string;
      toolName: string;
      title?: string;
    }
  | { type: "tool-input-delta"; toolCallId: string; inputTextDelta: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input?: unknown;
      title?: string;
    }
  | {
      type: "tool-output-available";
      toolCallId: string;
      output?: unknown;
      preliminary?: boolean;
    }
  | { type: "error"; errorText: string }
  | { type: "finish" };

type ClauxenDataChunk = {
  [K in keyof ClauxenUIDataParts & string]: {
    type: `data-${K}`;
    id?: string;
    data: ClauxenUIDataParts[K];
  };
}[keyof ClauxenUIDataParts & string];

type ClauxenStreamChunk = UIMessageChunk | ClauxenDataChunk;

function parsePartialToolInput(input: unknown): Record<string, unknown> {
  if (typeof input !== "string" || !input.trim()) return {};
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    const queryMatch = input.match(/"query"\s*:\s*"([^"]*)"/);
    if (queryMatch) return { query: queryMatch[1] };
    return {};
  }
}

type ChunkAdapterState = {
  agentMode: boolean;
  reasoningOpen: boolean;
  reasoningSegmentId: string | null;
  toolNames: Map<string, string>;
  toolInputJson: Map<string, string>;
};

function createChunkAdapterState(): ChunkAdapterState {
  return {
    agentMode: false,
    reasoningOpen: false,
    reasoningSegmentId: null,
    toolNames: new Map(),
    toolInputJson: new Map(),
  };
}

/** Convert one AI SDK UI message chunk into legacy StreamEvents for the agent reducer. */
export function uiMessageChunkToStreamEvents(
  chunk: ClauxenStreamChunk,
  state: ChunkAdapterState,
): StreamEvent[] {
  switch (chunk.type) {
    case "start":
      return [{ type: "start", agentMode: state.agentMode }];
    case "data-agent-mode": {
      const data = chunk.data as ClauxenUIDataParts["agent-mode"];
      if (data.enabled) state.agentMode = true;
      return [{ type: "start", agentMode: state.agentMode }];
    }
    case "reasoning-start":
      state.reasoningOpen = true;
      state.reasoningSegmentId = chunk.id;
      return [{ type: "thinking_start" }];
    case "reasoning-delta":
      return [
        {
          type: "thinking_delta",
          delta: chunk.delta,
        },
      ];
    case "reasoning-end":
      state.reasoningOpen = false;
      return [{ type: "thinking_end", segmentId: chunk.id }];
    case "text-delta":
      return [{ type: "answer_delta", delta: chunk.delta }];
    case "tool-input-start":
      state.toolNames.set(chunk.toolCallId, chunk.toolName);
      state.toolInputJson.set(chunk.toolCallId, "");
      return [
        {
          type: "tool_start",
          toolCallId: chunk.toolCallId,
          name: chunk.toolName,
          args: {},
          description: chunk.title,
        },
      ];
    case "tool-input-delta": {
      const prior = state.toolInputJson.get(chunk.toolCallId) ?? "";
      const next = prior + chunk.inputTextDelta;
      state.toolInputJson.set(chunk.toolCallId, next);
      const name = state.toolNames.get(chunk.toolCallId) ?? "tool";
      return [
        {
          type: "tool_start",
          toolCallId: chunk.toolCallId,
          name,
          args: parsePartialToolInput(next),
        },
      ];
    }
    case "tool-input-available":
      state.toolNames.set(chunk.toolCallId, chunk.toolName);
      return [
        {
          type: "tool_start",
          toolCallId: chunk.toolCallId,
          name: chunk.toolName,
          args:
            chunk.input && typeof chunk.input === "object"
              ? (chunk.input as Record<string, unknown>)
              : {},
          description: chunk.title,
        },
      ];
    case "tool-output-available": {
      if (chunk.preliminary) {
        const output = chunk.output as ClauxenToolStreamOutput | undefined;
        if (
          output &&
          typeof output === "object" &&
          (output.clauxenStream === "stdout" ||
            output.clauxenStream === "stderr") &&
          typeof output.delta === "string"
        ) {
          return [
            {
              type: "tool_output_delta",
              toolCallId: chunk.toolCallId,
              kind: output.clauxenStream,
              delta: output.delta,
            },
          ];
        }
        return [];
      }
      const name = state.toolNames.get(chunk.toolCallId) ?? "tool";
      const result =
        typeof chunk.output === "string"
          ? chunk.output
          : JSON.stringify(chunk.output ?? "");
      state.toolNames.delete(chunk.toolCallId);
      state.toolInputJson.delete(chunk.toolCallId);
      return [
        {
          type: "tool_end",
          toolCallId: chunk.toolCallId,
          name,
          result,
        },
      ];
    }
    case "data-artifact": {
      const data = chunk.data as ClauxenUIDataParts["artifact"];
      return [
        {
          type: "artifact_upsert",
          artifactId: data.artifactId,
          path: data.path,
          content: data.content,
          language: data.language,
          description: data.description,
          fileId: data.fileId,
          storagePath: data.storagePath,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
        },
      ];
    }
    case "data-tool-data": {
      const data = chunk.data as ClauxenUIDataParts["tool-data"];
      return [
        {
          type: "tool_data",
          toolCallId: data.toolCallId,
          data: data.data,
        },
      ];
    }
    case "data-step-done": {
      const data = chunk.data as ClauxenUIDataParts["step-done"];
      return [{ type: "step_done", label: data.label }];
    }
    case "data-agent-frame": {
      const data = chunk.data as ClauxenUIDataParts["agent-frame"];
      if (data.complete) {
        return [
          {
            type: "agent_frame_complete",
            frameId: data.frameId,
          },
        ];
      }
      if (data.frameId) {
        return [{ type: "agent_frame_start", frameId: data.frameId }];
      }
      return [];
    }
    case "data-chat-title": {
      const data = chunk.data as ClauxenUIDataParts["chat-title"];
      return [{ type: "chat_title", title: data.title }];
    }
    case "error":
      return [{ type: "error", message: chunk.errorText }];
    case "finish":
      return [{ type: "done" }];
    default:
      return [];
  }
}

const MAX_SSE_BUFFER_BYTES = 256 * 1024;

/**
 * Parse a Vercel AI SDK UI message SSE response into legacy StreamEvents.
 * Falls back to legacy JSON events when the response is not an AI SDK stream.
 */
export async function consumeClauxenStreamResponse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error("Failed to generate response");
  }

  const isUiMessageStream =
    response.headers.get("x-vercel-ai-ui-message-stream") === "v1";

  if (!isUiMessageStream) {
    let streamComplete = false;
    const parseChunk = createSseParser((event) => {
      onEvent(event);
      if (event.type === "done" || event.type === "error") {
        streamComplete = true;
      }
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        parseChunk(decoder.decode(value, { stream: true }));
        if (streamComplete) {
          await reader.cancel();
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (!streamComplete && !signal?.aborted) {
      // Proxies idle-cut SSE mid-turn. Soft-complete so ChatGPT/Claude-style
      // continues: keep painted tokens instead of "Connection was interrupted".
      onEvent({ type: "done" });
    }
    return;
  }

  const state = createChunkAdapterState();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamComplete = false;

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_SSE_BUFFER_BYTES) {
        buffer = buffer.slice(-MAX_SSE_BUFFER_BYTES / 2);
      }

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const rawEvent of parts) {
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payload = dataLine.slice(6).trim();
        if (!payload || payload === "[DONE]") {
          if (payload === "[DONE]") streamComplete = true;
          continue;
        }

        let chunk: ClauxenStreamChunk;
        try {
          chunk = JSON.parse(payload) as ClauxenStreamChunk;
        } catch {
          continue;
        }
        // Do not catch onEvent errors here. In particular, an `error` SSE
        // event must reject the stream promise so the live assistant receives
        // a visible failure state instead of silently finalizing blank.
        for (const event of uiMessageChunkToStreamEvents(chunk, state)) {
          onEvent(event);
          if (event.type === "done" || event.type === "error") {
            streamComplete = true;
          }
        }
      }

      if (streamComplete) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!streamComplete && !signal?.aborted) {
    // Soft-complete when the upstream closed without a terminal event — common
    // when a proxy briefly flaps. Prefer a finished partial answer over a hard
    // "connection lost" wipe when the client already painted tokens.
    onEvent({ type: "done" });
  }
}
