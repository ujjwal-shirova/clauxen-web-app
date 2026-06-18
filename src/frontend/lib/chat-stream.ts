export type StreamEvent =
  | { type: "start"; agentMode?: boolean }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string; segmentId?: string }
  | { type: "thinking_end"; segmentId?: string }
  | {
      type: "segment_start";
      segmentId: string;
      kind: "thinking" | "text" | "tool";
    }
  | {
      type: "segment_end";
      segmentId: string;
      kind: "thinking" | "text" | "tool";
    }
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
    }
  | { type: "step_done"; label?: string }
  | {
      type: "artifact_upsert";
      artifactId: string;
      path: string;
      content: string;
      language?: string;
      description?: string;
    }
  | { type: "agent_frame_start"; frameId: string }
  | { type: "agent_frame_complete"; frameId?: string }
  | { type: "answer_clear" }
  | { type: "chat_title"; title: string }
  | { type: "done" }
  | { type: "error"; message: string };

const MAX_SSE_BUFFER_BYTES = 256 * 1024;
const MAX_SSE_DATA_BYTES = 64 * 1024;

function parseStreamEvent(raw: unknown): StreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as {
    type?: unknown;
    delta?: unknown;
    message?: unknown;
    agentMode?: unknown;
    segmentId?: unknown;
    kind?: unknown;
    toolCallId?: unknown;
    name?: unknown;
    args?: unknown;
    description?: unknown;
    result?: unknown;
    data?: unknown;
    label?: unknown;
    artifactId?: unknown;
    path?: unknown;
    content?: unknown;
    language?: unknown;
    title?: unknown;
    frameId?: unknown;
  };

  switch (event.type) {
    case "start":
      return {
        type: "start",
        agentMode:
          typeof event.agentMode === "boolean" ? event.agentMode : undefined,
      };
    case "thinking_start":
    case "answer_clear":
    case "done":
      return { type: event.type };
    case "thinking_delta":
    case "answer_delta":
      return typeof event.delta === "string"
        ? {
            type: event.type,
            delta: event.delta,
            segmentId:
              typeof event.segmentId === "string"
                ? event.segmentId
                : undefined,
          }
        : null;
    case "thinking_end":
      return {
        type: "thinking_end",
        segmentId:
          typeof event.segmentId === "string" ? event.segmentId : undefined,
      };
    case "segment_start":
    case "segment_end":
      return typeof event.segmentId === "string" &&
        (event.kind === "thinking" ||
          event.kind === "text" ||
          event.kind === "tool")
        ? {
            type: event.type,
            segmentId: event.segmentId,
            kind: event.kind,
          }
        : null;
    case "tool_start":
      return typeof event.toolCallId === "string" &&
        typeof event.name === "string"
        ? {
            type: "tool_start",
            toolCallId: event.toolCallId,
            name: event.name,
            args:
              event.args && typeof event.args === "object"
                ? (event.args as Record<string, unknown>)
                : undefined,
            description:
              typeof event.description === "string"
                ? event.description
                : undefined,
          }
        : null;
    case "tool_output_delta":
      return typeof event.toolCallId === "string" &&
        typeof event.delta === "string" &&
        (event.kind === "stdout" || event.kind === "stderr")
        ? {
            type: "tool_output_delta",
            toolCallId: event.toolCallId,
            kind: event.kind,
            delta: event.delta,
          }
        : null;
    case "tool_data":
      return typeof event.toolCallId === "string" &&
        event.data &&
        typeof event.data === "object"
        ? {
            type: "tool_data",
            toolCallId: event.toolCallId,
            data: event.data as Record<string, unknown>,
          }
        : null;
    case "tool_end":
      return typeof event.toolCallId === "string" &&
        typeof event.name === "string" &&
        typeof event.result === "string"
        ? {
            type: "tool_end",
            toolCallId: event.toolCallId,
            name: event.name,
            result: event.result,
          }
        : null;
    case "step_done":
      return {
        type: "step_done",
        label: typeof event.label === "string" ? event.label : undefined,
      };
    case "artifact_upsert":
      return typeof event.artifactId === "string" &&
        typeof event.path === "string" &&
        typeof event.content === "string"
        ? {
            type: "artifact_upsert",
            artifactId: event.artifactId,
            path: event.path,
            content: event.content,
            language:
              typeof event.language === "string" ? event.language : undefined,
            description:
              typeof event.description === "string"
                ? event.description
                : undefined,
          }
        : null;
    case "agent_frame_complete":
      return {
        type: "agent_frame_complete",
        frameId:
          typeof event.frameId === "string" ? event.frameId : undefined,
      };
    case "agent_frame_start":
      return typeof event.frameId === "string"
        ? { type: "agent_frame_start", frameId: event.frameId }
        : null;
    case "chat_title":
      return typeof event.title === "string"
        ? { type: "chat_title", title: event.title }
        : null;
    case "error":
      return typeof event.message === "string"
        ? { type: "error", message: event.message }
        : null;
    default:
      return null;
  }
}

export function createSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = "";

  return (chunk: string) => {
    buffer += chunk;
    if (buffer.length > MAX_SSE_BUFFER_BYTES) {
      buffer = "";
      return;
    }

    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) {
        break;
      }

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        continue;
      }

      const payload = dataLine.slice(6);
      if (payload.length > MAX_SSE_DATA_BYTES) {
        continue;
      }

      try {
        const parsed = parseStreamEvent(JSON.parse(payload));
        if (parsed) {
          onEvent(parsed);
        }
      } catch {
        continue;
      }
    }
  };
}
