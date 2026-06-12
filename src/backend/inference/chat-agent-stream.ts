import { streamNovitaAgentChat } from "@/backend/inference/agent-stream";
import type { ToolEventSender } from "@/backend/inference/tool-executor";
import type { PlatformToolName } from "@/backend/inference/platform-tools";
import {
  encodeSseEvent,
  type ChatStreamEvent,
  type IncomingMessage,
  type ThinkingType,
} from "@/backend/inference/novita";

const AGENT_WEB_TOOLS: PlatformToolName[] = ["web_search", "web_fetch"];

type SegmentMode = "idle" | "thinking" | "text";

class InterleavedSegmentBridge {
  private mode: SegmentMode = "idle";
  private segmentCounter = 0;
  private thinkingSegmentId: string | null = null;
  private textSegmentId: string | null = null;
  private activeToolId: string | null = null;

  constructor(
    private readonly send: (event: ChatStreamEvent) => void,
  ) {}

  private nextSegmentId() {
    this.segmentCounter += 1;
    return `seg-${this.segmentCounter}`;
  }

  private closeThinking() {
    if (this.mode !== "thinking" || !this.thinkingSegmentId) return;
    this.send({
      type: "segment_end",
      segmentId: this.thinkingSegmentId,
      kind: "thinking",
    });
    this.mode = "idle";
    this.thinkingSegmentId = null;
  }

  private closeText() {
    if (this.mode !== "text" || !this.textSegmentId) return;
    this.send({
      type: "segment_end",
      segmentId: this.textSegmentId,
      kind: "text",
    });
    this.mode = "idle";
    this.textSegmentId = null;
  }

  onReasoningDelta(text: string) {
    if (!text) return;
    this.closeText();
    if (this.mode !== "thinking") {
      this.thinkingSegmentId = this.nextSegmentId();
      this.send({
        type: "segment_start",
        segmentId: this.thinkingSegmentId,
        kind: "thinking",
      });
      this.mode = "thinking";
    }
    this.send({
      type: "thinking_delta",
      delta: text,
      segmentId: this.thinkingSegmentId ?? undefined,
    });
  }

  onAnswerDelta(text: string) {
    if (!text) return;
    this.send({ type: "answer_delta", delta: text });
  }

  onFrameComplete() {
    this.closeThinking();
    this.closeText();
    this.send({ type: "agent_frame_complete" });
  }

  onToolExecuting(payload: {
    tool_call_id: string;
    name: string;
    args?: Record<string, unknown>;
    description?: string;
  }) {
    this.closeThinking();
    this.closeText();
    this.activeToolId = payload.tool_call_id;
    this.send({
      type: "tool_start",
      toolCallId: payload.tool_call_id,
      name: payload.name,
      args: payload.args ?? {},
      description: payload.description,
    });
  }

  onToolResult(payload: {
    tool_call_id: string;
    name: string;
    result: string;
  }) {
    this.send({
      type: "tool_end",
      toolCallId: payload.tool_call_id,
      name: payload.name,
      result: payload.result,
    });
    if (this.activeToolId === payload.tool_call_id) {
      this.activeToolId = null;
    }
  }

  onToolData(payload: Record<string, unknown>) {
    if (!this.activeToolId) return;
    this.send({
      type: "tool_data",
      toolCallId: this.activeToolId,
      data: payload,
    });
  }

  onToolOutput(text: string, kind: "stdout" | "stderr") {
    if (!this.activeToolId || !text) return;
    this.send({
      type: "tool_output_delta",
      toolCallId: this.activeToolId,
      kind,
      delta: text,
    });
  }

  finalize() {
    this.closeThinking();
    this.closeText();
  }
}

export function streamChatAgent(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    thinkingType?: ThinkingType;
    userId?: string;
    conversationId?: string;
    webSearchEnabled?: boolean;
  },
): ReadableStream<Uint8Array> {
  const thinkingType = options?.thinkingType ?? "disabled";
  const webSearchEnabled = options?.webSearchEnabled ?? false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendChat = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };

      sendChat({ type: "start", agentMode: true });
      const bridge = new InterleavedSegmentBridge(sendChat);

      const sendAgent: ToolEventSender = (event, data) => {
        const payload = (data ?? {}) as Record<string, unknown>;

        switch (event) {
          case "text_delta":
            bridge.onAnswerDelta(String(payload.text ?? ""));
            return;
          case "frame_complete":
            bridge.onFrameComplete();
            return;
          case "reasoning_delta":
            bridge.onReasoningDelta(String(payload.text ?? ""));
            return;
          case "tool_executing":
            bridge.onToolExecuting({
              tool_call_id: String(payload.tool_call_id ?? ""),
              name: String(payload.name ?? ""),
              args:
                payload.args && typeof payload.args === "object"
                  ? (payload.args as Record<string, unknown>)
                  : {},
              description:
                typeof payload.description === "string"
                  ? payload.description
                  : undefined,
            });
            return;
          case "tool_result":
            bridge.onToolResult({
              tool_call_id: String(payload.tool_call_id ?? ""),
              name: String(payload.name ?? ""),
              result: String(payload.result ?? ""),
            });
            return;
          case "web_search_results":
            bridge.onToolData(payload);
            return;
          case "bash_stdout":
            bridge.onToolOutput(String(payload.text ?? ""), "stdout");
            return;
          case "bash_stderr":
            bridge.onToolOutput(String(payload.text ?? ""), "stderr");
            return;
          case "error":
            sendChat({
              type: "error",
              message: String(payload.message ?? "Error"),
            });
            return;
          default:
            return;
        }
      };

      try {
        await streamNovitaAgentChat(
          {
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            enableThinking: thinkingType === "enabled",
            reasoningSplit: thinkingType === "enabled",
            allowedTools: webSearchEnabled ? AGENT_WEB_TOOLS : [],
            webSearchMode: webSearchEnabled,
          },
          sendAgent,
          signal,
          {
            userId: options?.userId,
            conversationId: options?.conversationId,
          },
        );
        bridge.finalize();
        sendChat({ type: "done" });
        controller.close();
      } catch (error) {
        bridge.finalize();
        const message =
          error instanceof Error ? error.message : "Stream failed.";
        sendChat({ type: "error", message });
        controller.close();
      }
    },
  });
}

/** @deprecated Use streamChatAgent */
export const streamChatWithWebSearch = streamChatAgent;
