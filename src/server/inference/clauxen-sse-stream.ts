/**
 * Clauxen SSE Stream — server-side event emitter for the agent protocol.
 *
 * Wire format (one JSON object per SSE data frame):
 *   data: {"type":"narration_delta","segmentId":"...","delta":"..."}\n\n
 *
 * Protocol (emitted by the agent loop, consumed by use-chat.ts +
 * agent-stream-reducer):
 *   start                      — turn begins (agentMode)
 *   agent_frame_start/complete — single work frame per turn
 *   segment_start/end          — thinking | narration segments
 *   thinking_delta/end         — extended-thinking stream
 *   narration_delta            — visible progress prose + the final answer
 *                                (streams as a segment, promoted at the end)
 *   answer_finalize            — promotes the final text segment to the answer
 *   tool_start/output_delta/data/end — tool lifecycle
 *   artifact_upsert            — create_file deliverable cards
 *   chat_title / error / done
 */

import type { StreamEvent } from "@/lib/chat-stream";
import { toUserFacingChatError } from "@/lib/assistant-generation-error";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
} as const;

export const CLAUXEN_STREAM_HEADERS: Record<string, string> = SSE_HEADERS;

type StreamController = {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
  error: (error: unknown) => void;
};

export class ClauxenSseStream {
  private controller: StreamController | null = null;
  private closed = false;
  /** Buffer frames written before the HTTP consumer attaches the controller. */
  private pending: Uint8Array[] = [];
  private readyResolve: (() => void) | null = null;
  readonly ready: Promise<void>;
  readonly stream: ReadableStream<Uint8Array>;
  private readonly encoder = new TextEncoder();

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller: StreamController) => {
        this.controller = controller;
        if (this.pending.length > 0) {
          for (const chunk of this.pending) {
            try {
              controller.enqueue(chunk);
            } catch {
              break;
            }
          }
          this.pending = [];
        }
        this.readyResolve?.();
        this.readyResolve = null;
      },
      cancel: () => {
        this.closed = true;
        this.pending = [];
        this.readyResolve?.();
        this.readyResolve = null;
      },
    });
  }

  /** Write a single SSE event to the stream. */
  write(event: StreamEvent): void {
    if (this.closed) return;
    const payload = this.encoder.encode(
      `data: ${JSON.stringify(event)}\n\n`,
    );
    if (!this.controller) {
      // Consumer not attached yet — queue so early start/tool/narration
      // frames are never dropped (looks like a hung assistant otherwise).
      this.pending.push(payload);
      return;
    }
    try {
      this.controller.enqueue(payload);
    } catch {
      this.closed = true;
    }
  }

  writeStart(agentMode = false): void {
    this.write({ type: "start", agentMode });
  }

  writeThinkingStart(): void {
    this.write({ type: "thinking_start" });
  }

  writeThinkingDelta(delta: string, segmentId?: string): void {
    if (!delta) return;
    this.write(
      segmentId
        ? { type: "thinking_delta", delta, segmentId }
        : { type: "thinking_delta", delta },
    );
  }

  writeThinkingEnd(segmentId?: string): void {
    this.write(
      segmentId
        ? { type: "thinking_end", segmentId }
        : { type: "thinking_end" },
    );
  }

  writeAnswerDelta(delta: string): void {
    if (!delta) return;
    this.write({ type: "answer_delta", delta });
  }

  /** Promote a narration segment to the durable final answer. */
  writeAnswerFinalize(segmentId: string | undefined, text: string): void {
    if (!text.trim()) return;
    this.write({ type: "answer_finalize", segmentId, text });
  }

  writeFrameStart(frameId: string): void {
    this.write({ type: "agent_frame_start", frameId });
  }

  writeFrameComplete(frameId?: string): void {
    this.write({ type: "agent_frame_complete", frameId });
  }

  writeSegmentStart(
    segmentId: string,
    kind: "thinking" | "narration" | "text" | "tool",
  ): void {
    this.write({ type: "segment_start", segmentId, kind });
  }

  writeSegmentEnd(
    segmentId: string,
    kind: "thinking" | "narration" | "text" | "tool",
  ): void {
    this.write({ type: "segment_end", segmentId, kind });
  }

  writeNarrationDelta(segmentId: string, delta: string): void {
    if (!delta) return;
    this.write({ type: "narration_delta", segmentId, delta });
  }

  writeToolStart(
    toolCallId: string,
    name: string,
    args?: Record<string, unknown>,
    description?: string,
    argsComplete?: boolean,
  ): void {
    this.write({
      type: "tool_start",
      toolCallId,
      name,
      args,
      description,
      argsComplete,
    });
  }

  writeToolOutputDelta(
    toolCallId: string,
    kind: "stdout" | "stderr",
    delta: string,
  ): void {
    this.write({ type: "tool_output_delta", toolCallId, kind, delta });
  }

  writeToolData(
    toolCallId: string,
    data: Record<string, unknown>,
  ): void {
    this.write({ type: "tool_data", toolCallId, data });
  }

  writeToolEnd(
    toolCallId: string,
    name: string,
    result: string,
    isError?: boolean,
  ): void {
    this.write({ type: "tool_end", toolCallId, name, result, isError });
  }

  writeArtifact(artifact: {
    artifactId: string;
    path: string;
    content: string;
    language?: string;
    description?: string;
    fileId?: string;
    storagePath?: string;
    mimeType?: string;
    sizeBytes?: number;
  }): void {
    this.write({
      type: "artifact_upsert",
      ...artifact,
    });
  }

  writeChatTitle(title: string): void {
    this.write({ type: "chat_title", title });
  }

  writeError(message: string): void {
    // Never stream vendor/API internals into the chat transcript.
    this.write({ type: "error", message: toUserFacingChatError(message) });
  }

  writeDone(): void {
    this.write({ type: "done" });
  }

  /** Close the stream. After this, no more events can be written. */
  finalize(): void {
    if (this.closed) return;
    this.closed = true;
    this.pending = [];
    try {
      this.controller?.close();
    } catch {
      // already closed
    }
    this.readyResolve?.();
    this.readyResolve = null;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

/** Create a Response from a ClauxenSseStream with proper SSE headers. */
export function createStreamResponse(stream: ClauxenSseStream): Response {
  return new Response(stream.stream, {
    headers: CLAUXEN_STREAM_HEADERS,
  });
}
