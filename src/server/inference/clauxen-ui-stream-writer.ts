import type {
  ClauxenToolStreamOutput,
  ClauxenUIMessage,
} from "@/lib/clauxen-ui-message";

function parsePartialToolArgs(input: unknown): Record<string, unknown> {
  if (typeof input !== "string" || !input.trim()) return {};
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    const queryMatch = input.match(/"query"\s*:\s*"([^"]*)"/);
    if (queryMatch) return { query: queryMatch[1] };
    return {};
  }
}

/**
 * Minimal writer interface — replaces Vercel AI SDK's UIMessageStreamWriter.
 * Accepts arbitrary chunk objects and serializes them as SSE.
 */
export interface ClauxenStreamWriterSink {
  enqueue: (chunk: Record<string, unknown>) => void;
  close: () => void;
  error: (err: unknown) => void;
}

/**
 * Maps Clauxen agent events to UI message chunks and writes them as SSE.
 * This replaces the Vercel AI SDK's UIMessageStreamWriter with our own
 * lightweight implementation.
 */
export class ClauxenUiStreamWriter {
  private segmentCounter = 0;
  private reasoningId: string | null = null;
  private textId: string | null = null;
  private activeToolId: string | null = null;
  private readonly toolNames = new Map<string, string>();
  private readonly toolInputJson = new Map<string, string>();

  constructor(
    private readonly sink: ClauxenStreamWriterSink,
  ) {}

  private nextSegmentId() {
    this.segmentCounter += 1;
    return `seg-${this.segmentCounter}`;
  }

  private ensureTextId() {
    if (!this.textId) {
      this.textId = this.nextSegmentId();
      this.sink.enqueue({ type: "text-start", id: this.textId });
    }
    return this.textId;
  }

  private closeReasoning() {
    if (!this.reasoningId) return;
    this.sink.enqueue({ type: "reasoning-end", id: this.reasoningId });
    this.reasoningId = null;
  }

  private closeText() {
    if (!this.textId) return;
    this.sink.enqueue({ type: "text-end", id: this.textId });
    this.textId = null;
  }

  writeStart(agentMode?: boolean) {
    this.sink.enqueue({ type: "start" });
    if (agentMode) {
      this.sink.enqueue({
        type: "data-agent-mode",
        data: { enabled: true },
      });
    }
  }

  onReasoningDelta(text: string) {
    if (!text) return;
    this.closeText();
    if (!this.reasoningId) {
      this.reasoningId = this.nextSegmentId();
      this.sink.enqueue({ type: "reasoning-start", id: this.reasoningId });
    }
    this.sink.enqueue({
      type: "reasoning-delta",
      id: this.reasoningId,
      delta: text,
    });
  }

  onReasoningEnd() {
    this.closeReasoning();
  }

  onAnswerDelta(text: string) {
    if (!text) return;
    const id = this.ensureTextId();
    this.sink.enqueue({ type: "text-delta", id, delta: text });
  }

  onAnswerClear() {
    this.closeText();
    this.textId = null;
    this.sink.enqueue({
      type: "data-answer-clear",
      data: {},
    });
  }

  onFrameComplete(frameId?: string) {
    this.closeReasoning();
    this.closeText();
    this.sink.enqueue({
      type: "data-agent-frame",
      data: { complete: true, frameId },
    });
  }

  onInterimCapture(text: string) {
    if (!text.trim()) return;
    this.closeReasoning();
    this.closeText();
    this.sink.enqueue({
      type: "data-agent-interim",
      data: { text: text.trim() },
    });
  }

  onFrameStart(frameId: string) {
    this.closeReasoning();
    this.closeText();
    this.sink.enqueue({
      type: "data-agent-frame",
      data: { complete: false, frameId },
    });
  }

  onToolStreaming(payload: {
    tool_calls?: Array<{ id?: string; name?: string; input?: string }>;
  }) {
    const tool = payload.tool_calls?.[0];
    if (!tool?.id || !tool.name) return;

    this.closeReasoning();
    this.closeText();

    const priorInput = this.toolInputJson.get(tool.id) ?? "";
    const alreadyStarted = this.toolNames.has(tool.id);
    const nextInput = typeof tool.input === "string" ? tool.input : priorInput;
    this.toolInputJson.set(tool.id, nextInput);
    this.toolNames.set(tool.id, tool.name);
    this.activeToolId = tool.id;

    if (!alreadyStarted) {
      this.sink.enqueue({
        type: "tool-input-start",
        toolCallId: tool.id,
        toolName: tool.name,
        dynamic: true,
      });
    }

    const delta = nextInput.slice(priorInput.length);
    if (delta) {
      this.sink.enqueue({
        type: "tool-input-delta",
        toolCallId: tool.id,
        inputTextDelta: delta,
      });
    }
  }

  onToolExecuting(payload: {
    tool_call_id: string;
    name: string;
    args?: Record<string, unknown>;
    description?: string;
  }) {
    this.closeReasoning();
    this.closeText();
    this.activeToolId = payload.tool_call_id;
    this.toolNames.set(payload.tool_call_id, payload.name);

    this.sink.enqueue({
      type: "tool-input-start",
      toolCallId: payload.tool_call_id,
      toolName: payload.name,
      dynamic: true,
      title: payload.description,
    });
    this.sink.enqueue({
      type: "tool-input-available",
      toolCallId: payload.tool_call_id,
      toolName: payload.name,
      input: payload.args ?? {},
      dynamic: true,
      title: payload.description,
    });
  }

  onToolResult(payload: {
    tool_call_id: string;
    name: string;
    result: string;
  }) {
    this.sink.enqueue({
      type: "tool-output-available",
      toolCallId: payload.tool_call_id,
      output: payload.result,
      preliminary: false,
      dynamic: true,
    });
    if (this.activeToolId === payload.tool_call_id) {
      this.activeToolId = null;
    }
    this.toolInputJson.delete(payload.tool_call_id);
    this.toolNames.delete(payload.tool_call_id);
  }

  onArtifact(payload: {
    path: string;
    content: string;
    language?: string;
    description?: string;
  }) {
    if (!payload.path) return;
    this.sink.enqueue({
      type: "data-artifact",
      id: payload.path,
      data: {
        artifactId: payload.path,
        path: payload.path,
        content: payload.content,
        language: payload.language,
        description: payload.description,
      },
    });
  }

  onToolData(payload: Record<string, unknown>) {
    const toolCallId =
      typeof payload.tool_call_id === "string"
        ? payload.tool_call_id
        : this.activeToolId;
    if (!toolCallId) return;
    this.sink.enqueue({
      type: "data-tool-data",
      id: toolCallId,
      data: { toolCallId, data: payload },
    });
  }

  onStepDone(label?: string) {
    this.sink.enqueue({
      type: "data-step-done",
      data: { label },
    });
  }

  onToolOutput(text: string, kind: "stdout" | "stderr") {
    if (!this.activeToolId || !text) return;
    const output: ClauxenToolStreamOutput = {
      clauxenStream: kind,
      delta: text,
    };
    this.sink.enqueue({
      type: "tool-output-available",
      toolCallId: this.activeToolId,
      output,
      preliminary: true,
      dynamic: true,
    });
  }

  onChatTitle(title: string) {
    if (!title.trim()) return;
    this.sink.enqueue({
      type: "data-chat-title",
      data: { title },
    });
  }

  onError(message: string) {
    this.sink.enqueue({ type: "error", errorText: message });
  }

  finalize() {
    this.closeReasoning();
    this.closeText();
    this.sink.enqueue({ type: "finish" });
  }

  toolNameFor(toolCallId: string) {
    return this.toolNames.get(toolCallId);
  }

  toolInputFor(toolCallId: string) {
    return parsePartialToolArgs(this.toolInputJson.get(toolCallId) ?? "");
  }
}

// Suppress unused type warning
export type { ClauxenUIMessage };
