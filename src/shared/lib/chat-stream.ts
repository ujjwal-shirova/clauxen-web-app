/**
 * Agent SSE protocol — turn-scoped, flat trace.
 *
 * Wire format (one JSON object per SSE data frame):
 *   data: {"type":"narration_delta","segmentId":"...","delta":"..."}\n\n
 *
 * Event lifecycle:
 *   start            — turn begins (agentMode)
 *   turn_ready       — durable ids after insert
 *   thinking_start / thinking_delta / thinking_end
 *   narration_delta  — first-person progress prose + the final answer text
 *   answer_finalize  — promotes the final narration segment to Message.content
 *   tool_start / tool_output_delta / tool_data / tool_end
 *   artifact_upsert  — create_file deliverable cards
 *   chat_title / error / done
 */

export type StreamEvent =
  | { type: "start"; agentMode?: boolean; assistantMessageId?: string }
  | {
      /** Durable turn ids after Supabase insert — may arrive after SSE start. */
      type: "turn_ready";
      userMessageId?: string;
      assistantMessageId?: string;
    }
  | { type: "thinking_start"; segmentId?: string }
  | { type: "thinking_delta"; delta: string; segmentId?: string }
  | { type: "thinking_end"; segmentId?: string }
  | {
      type: "segment_start";
      segmentId: string;
      kind: "thinking" | "narration" | "tool";
    }
  | {
      type: "segment_end";
      segmentId: string;
      kind: "thinking" | "narration" | "tool";
    }
  | { type: "text_delta"; delta: string; segmentId: string }
  | { type: "narration_delta"; delta: string; segmentId: string }
  | { type: "answer_delta"; delta: string; segmentId?: string }
  | {
      /** Final-round text promotion: the narration segment with this id is
       * the durable answer. The UI restyles it in place — no teleporting. */
      type: "answer_finalize";
      segmentId?: string;
      text: string;
    }
  | {
      type: "tool_start";
      toolCallId: string;
      name: string;
      args?: Record<string, unknown>;
      description?: string;
      /** false while args are still streaming in (e.g. bash_tool's command
       * being typed); true/undefined once the call is finalized and about
       * to execute. Absent entirely for tools that never stream partial args. */
      argsComplete?: boolean;
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
    toolCallId?: unknown;
    name?: unknown;
    args?: unknown;
    description?: unknown;
    result?: unknown;
    data?: unknown;
    artifactId?: unknown;
    path?: unknown;
    content?: unknown;
    language?: unknown;
    title?: unknown;
    text?: unknown;
    isError?: unknown;
    argsComplete?: unknown;
    kind?: unknown;
    fileId?: unknown;
    storagePath?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };

  const optString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  switch (event.type) {
    case "start":
      return {
        type: "start",
        agentMode:
          typeof event.agentMode === "boolean" ? event.agentMode : undefined,
        assistantMessageId:
          optString(event.segmentId) === undefined &&
          typeof (event as { assistantMessageId?: unknown })
            .assistantMessageId === "string"
            ? (event as { assistantMessageId: string }).assistantMessageId
            : undefined,
      };
    case "turn_ready": {
      const userMessageId = optString(
        (event as { userMessageId?: unknown }).userMessageId,
      );
      const assistantMessageId = optString(
        (event as { assistantMessageId?: unknown }).assistantMessageId,
      );
      if (!userMessageId && !assistantMessageId) return null;
      return { type: "turn_ready", userMessageId, assistantMessageId };
    }
    case "thinking_start":
      return { type: "thinking_start", segmentId: optString(event.segmentId) };
    case "done":
      return { type: event.type };
    case "thinking_delta":
    case "answer_delta":
      return typeof event.delta === "string"
        ? {
            type: event.type,
            delta: event.delta,
            segmentId: optString(event.segmentId),
          }
        : null;
    case "text_delta":
    case "narration_delta":
      return typeof event.delta === "string" &&
        typeof event.segmentId === "string"
        ? { type: event.type, delta: event.delta, segmentId: event.segmentId }
        : null;
    case "answer_finalize":
      return typeof event.text === "string"
        ? {
            type: "answer_finalize",
            text: event.text,
            segmentId: optString(event.segmentId),
          }
        : null;
    case "thinking_end":
      return { type: "thinking_end", segmentId: optString(event.segmentId) };
    case "segment_start":
    case "segment_end":
      return typeof event.segmentId === "string" &&
        (event.kind === "thinking" ||
          event.kind === "narration" ||
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
            description: optString(event.description),
            argsComplete:
              typeof event.argsComplete === "boolean"
                ? event.argsComplete
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
            isError:
              typeof event.isError === "boolean" ? event.isError : undefined,
          }
        : null;
    case "artifact_upsert":
      return typeof event.artifactId === "string" &&
        typeof event.path === "string" &&
        (typeof event.content === "string" || typeof event.fileId === "string")
        ? {
            type: "artifact_upsert",
            artifactId: event.artifactId,
            path: event.path,
            content: typeof event.content === "string" ? event.content : "",
            language: optString(event.language),
            description: optString(event.description),
            fileId: optString(event.fileId),
            storagePath: optString(event.storagePath),
            mimeType: optString(event.mimeType),
            sizeBytes:
              typeof event.sizeBytes === "number" ? event.sizeBytes : undefined,
          }
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

      let parsed: StreamEvent | null = null;
      try {
        parsed = parseStreamEvent(JSON.parse(payload));
      } catch {
        continue;
      }
      // Deliberately keep the consumer callback outside the JSON parse guard.
      // A server-side `error` event makes the UI callback throw; swallowing it
      // here converted a real generation error into a blank "successful" turn.
      if (parsed) onEvent(parsed);
    }
  };
}
