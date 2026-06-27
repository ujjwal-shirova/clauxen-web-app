/**
 * Clauxen SSE Stream — lightweight server-side event emitter.
 *
 * Replaces Vercel AI SDK's createUIMessageStream / UIMessageStreamWriter.
 * Produces a ReadableStream<Uint8Array> of SSE-formatted bytes that the
 * frontend consumeClauxenStreamResponse() parser already understands.
 *
 * The wire format is the same legacy SSE protocol the frontend already uses:
 *   data: {"type":"answer_delta","delta":"..."}\n\n
 *   data: {"type":"done"}\n\n
 *
 * This means the frontend's existing StreamEvent reducer works unchanged.
 */

import type { StreamEvent } from "@/frontend/lib/chat-stream";

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
  readonly stream: ReadableStream<Uint8Array>;
  private readonly encoder = new TextEncoder();

  constructor() {
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller: StreamController) => {
        this.controller = controller;
      },
      cancel: () => {
        this.closed = true;
      },
    });
  }

  /** Write a single SSE event to the stream. */
  write(event: StreamEvent): void {
    if (this.closed || !this.controller) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }

  /** Convenience helpers for the most common event types. */
  writeStart(agentMode = false): void {
    this.write({ type: "start", agentMode });
  }

  writeThinkingStart(): void {
    this.write({ type: "thinking_start" });
  }

  writeThinkingDelta(delta: string): void {
    if (!delta) return;
    this.write({ type: "thinking_delta", delta });
  }

  writeThinkingEnd(segmentId?: string): void {
    this.write({ type: "thinking_end", segmentId });
  }

  writeAnswerDelta(delta: string): void {
    if (!delta) return;
    this.write({ type: "answer_delta", delta });
  }

  writeAnswerClear(): void {
    this.write({ type: "answer_clear" });
  }

  writeFrameStart(frameId: string): void {
    this.write({ type: "agent_frame_start", frameId });
  }

  writeFrameComplete(frameId?: string): void {
    this.write({ type: "agent_frame_complete", frameId });
  }

  writeInterim(text: string): void {
    if (!text.trim()) return;
    this.write({ type: "agent_interim", text });
  }

  writeToolStart(
    toolCallId: string,
    name: string,
    args?: Record<string, unknown>,
    description?: string,
  ): void {
    this.write({ type: "tool_start", toolCallId, name, args, description });
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

  writeToolEnd(toolCallId: string, name: string, result: string): void {
    this.write({ type: "tool_end", toolCallId, name, result });
  }

  writeStepDone(label?: string): void {
    this.write({ type: "step_done", label });
  }

  writeArtifact(
    artifactId: string,
    path: string,
    content: string,
    language?: string,
    description?: string,
  ): void {
    this.write({
      type: "artifact_upsert",
      artifactId,
      path,
      content,
      language,
      description,
    });
  }

  writeChatTitle(title: string): void {
    this.write({ type: "chat_title", title });
  }

  writeError(message: string): void {
    this.write({ type: "error", message });
  }

  writeDone(): void {
    this.write({ type: "done" });
  }

  /** Close the stream. After this, no more events can be written. */
  finalize(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller?.close();
    } catch {
      // already closed
    }
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
