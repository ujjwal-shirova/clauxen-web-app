import type { UIMessageStreamWriter } from "ai";
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
 * Maps Clauxen agent events to Vercel AI SDK UI message chunks while keeping
 * Anthropic SDK inference on the server unchanged.
 */
export class ClauxenUiStreamWriter {
  private segmentCounter = 0;
  private reasoningId: string | null = null;
  private textId: string | null = null;
  private activeToolId: string | null = null;
  private readonly toolNames = new Map<string, string>();
  private readonly toolInputJson = new Map<string, string>();

  constructor(
    private readonly writer: UIMessageStreamWriter<ClauxenUIMessage>,
  ) {}

  private nextSegmentId() {
    this.segmentCounter += 1;
    return `seg-${this.segmentCounter}`;
  }

  private ensureTextId() {
    if (!this.textId) {
      this.textId = this.nextSegmentId();
      this.writer.write({ type: "text-start", id: this.textId });
    }
    return this.textId;
  }

  private closeReasoning() {
    if (!this.reasoningId) return;
    this.writer.write({ type: "reasoning-end", id: this.reasoningId });
    this.reasoningId = null;
  }

  private closeText() {
    if (!this.textId) return;
    this.writer.write({ type: "text-end", id: this.textId });
    this.textId = null;
  }

  writeStart(agentMode?: boolean) {
    this.writer.write({ type: "start" });
    if (agentMode) {
      this.writer.write({
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
      this.writer.write({ type: "reasoning-start", id: this.reasoningId });
    }
    this.writer.write({
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
    this.writer.write({ type: "text-delta", id, delta: text });
  }

  onAnswerClear() {
    this.closeText();
    this.textId = null;
    this.writer.write({
      type: "data-answer-clear",
      data: {},
    });
  }

  onFrameComplete(frameId?: string) {
    this.closeReasoning();
    this.closeText();
    this.writer.write({
      type: "data-agent-frame",
      data: { complete: true, frameId },
    });
  }

  onInterimCapture(text: string) {
    if (!text.trim()) return;
    this.closeReasoning();
    this.closeText();
    this.writer.write({
      type: "data-agent-interim",
      data: { text: text.trim() },
    });
  }

  onFrameStart(frameId: string) {
    this.closeReasoning();
    this.closeText();
    this.writer.write({
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
      this.writer.write({
        type: "tool-input-start",
        toolCallId: tool.id,
        toolName: tool.name,
        dynamic: true,
      });
    }

    const delta = nextInput.slice(priorInput.length);
    if (delta) {
      this.writer.write({
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

    this.writer.write({
      type: "tool-input-start",
      toolCallId: payload.tool_call_id,
      toolName: payload.name,
      dynamic: true,
      title: payload.description,
    });
    this.writer.write({
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
    this.writer.write({
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
    this.writer.write({
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
    this.writer.write({
      type: "data-tool-data",
      id: toolCallId,
      data: { toolCallId, data: payload },
    });
  }

  onStepDone(label?: string) {
    this.writer.write({
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
    this.writer.write({
      type: "tool-output-available",
      toolCallId: this.activeToolId,
      output,
      preliminary: true,
      dynamic: true,
    });
  }

  onChatTitle(title: string) {
    if (!title.trim()) return;
    this.writer.write({
      type: "data-chat-title",
      data: { title },
    });
  }

  onError(message: string) {
    this.writer.write({ type: "error", errorText: message });
  }

  finalize() {
    this.closeReasoning();
    this.closeText();
    this.writer.write({ type: "finish" });
  }

  toolNameFor(toolCallId: string) {
    return this.toolNames.get(toolCallId);
  }

  toolInputFor(toolCallId: string) {
    return parsePartialToolArgs(this.toolInputJson.get(toolCallId) ?? "");
  }
}
