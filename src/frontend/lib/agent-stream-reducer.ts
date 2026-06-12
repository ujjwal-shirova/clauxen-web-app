import type { StreamEvent } from "@/frontend/lib/chat-stream";
import type {
  AgentSegment,
  AgentToolSegment,
  WebSearchResult,
} from "@/frontend/lib/agent-segments";
import { parseToolResult } from "@/frontend/lib/agent-segments";
import type { Message } from "@/frontend/lib/types";

function upsertSegment(
  segments: AgentSegment[],
  segment: AgentSegment,
): AgentSegment[] {
  const index = segments.findIndex((item) => item.id === segment.id);
  if (index === -1) return [...segments, segment];
  const next = [...segments];
  next[index] = segment;
  return next;
}

function finalizeStreamingSegments(segments: AgentSegment[]): AgentSegment[] {
  return segments.map((segment) => {
    if (segment.kind === "thinking" && segment.isStreaming) {
      const durationSeconds = segment.startedAtMs
        ? Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000))
        : segment.durationSeconds;
      return { ...segment, isStreaming: false, durationSeconds };
    }
    if (segment.kind === "text" && segment.isStreaming) {
      return { ...segment, isStreaming: false };
    }
    if (segment.kind === "tool" && segment.status === "running") {
      return {
        ...segment,
        status: "done",
        completedAtMs: Date.now(),
      };
    }
    return segment;
  });
}

function enrichToolFromResult(
  tool: AgentToolSegment,
  result: string,
): AgentToolSegment {
  const parsed = parseToolResult(result);
  const next: AgentToolSegment = {
    ...tool,
    result,
    status: "done",
    completedAtMs: Date.now(),
  };

  if (tool.name === "web_search") {
    if (Array.isArray(parsed)) {
      next.searchResults = parsed as WebSearchResult[];
      const query =
        typeof tool.args?.query === "string" ? tool.args.query : undefined;
      if (query) next.searchQuery = query;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as { error?: string; query?: string };
      if (record.error) next.status = "error";
      if (record.query) next.searchQuery = record.query;
    }
  }

  if (tool.name === "bash_tool" && !next.stdout?.trim()) {
    if (typeof parsed === "string") {
      next.stdout = parsed;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as { stdout?: string; stderr?: string };
      next.stdout = record.stdout ?? next.stdout;
      next.stderr = record.stderr ?? next.stderr;
    }
  }

  return next;
}

export function applyAgentStreamEvent(
  message: Message,
  event: StreamEvent,
): Message {
  const segments = [...(message.agentSegments ?? [])];
  let thinkingContent = message.thinkingContent ?? "";
  let content = message.content ?? "";
  let hasThinking = message.hasThinking ?? false;
  let isThinkingStreaming = message.isThinkingStreaming ?? false;
  let agentMode = message.agentMode ?? false;

  switch (event.type) {
    case "start":
      return {
        ...message,
        agentMode: event.agentMode ?? agentMode,
        agentSegments: event.agentMode ? [] : message.agentSegments,
        agentFrameComplete: false,
        isStreaming: true,
      };

    case "segment_start":
      agentMode = true;
      if (event.kind === "thinking") {
        hasThinking = true;
        isThinkingStreaming = true;
        return {
          ...message,
          agentMode,
          hasThinking,
          isThinkingStreaming,
          thinkingStartedAtMs: message.thinkingStartedAtMs ?? Date.now(),
          agentSegments: upsertSegment(segments, {
            kind: "thinking",
            id: event.segmentId,
            content: "",
            isStreaming: true,
            startedAtMs: Date.now(),
          }),
        };
      }
      if (event.kind === "text") {
        return message;
      }
      return message;

    case "thinking_start":
      hasThinking = true;
      isThinkingStreaming = true;
      return {
        ...message,
        hasThinking,
        isThinkingStreaming,
        thinkingStartedAtMs: message.thinkingStartedAtMs ?? Date.now(),
        isStreaming: true,
      };

    case "thinking_delta": {
      thinkingContent += event.delta;
      hasThinking = true;
      if (event.segmentId) {
        agentMode = true;
        const existing = segments.find(
          (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
            segment.id === event.segmentId && segment.kind === "thinking",
        );
        const nextThinking = {
          kind: "thinking" as const,
          id: event.segmentId,
          content: `${existing?.content ?? ""}${event.delta}`,
          isStreaming: true,
          startedAtMs: existing?.startedAtMs ?? Date.now(),
        };
        return {
          ...message,
          agentMode,
          thinkingContent,
          hasThinking,
          isThinkingStreaming: true,
          agentSegments: upsertSegment(segments, nextThinking),
          isStreaming: true,
        };
      }
      return {
        ...message,
        thinkingContent,
        hasThinking,
        isThinkingStreaming: true,
        isStreaming: true,
      };
    }

    case "thinking_end":
    case "segment_end": {
      const isThinkingSegment =
        event.type === "thinking_end" ||
        (event.type === "segment_end" && event.kind === "thinking");
      if (isThinkingSegment) {
        isThinkingStreaming = false;
        if (event.segmentId) {
          const existing = segments.find(
            (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
              segment.id === event.segmentId && segment.kind === "thinking",
          );
          if (existing) {
            const durationSeconds = existing.startedAtMs
              ? Math.max(
                  1,
                  Math.round((Date.now() - existing.startedAtMs) / 1000),
                )
              : existing.durationSeconds;
            return {
              ...message,
              isThinkingStreaming: false,
              thinkingDurationSeconds: durationSeconds,
              agentSegments: upsertSegment(segments, {
                ...existing,
                isStreaming: false,
                durationSeconds,
              }),
            };
          }
        }
        return { ...message, isThinkingStreaming: false };
      }
      if (event.type === "segment_end" && event.kind === "text" && event.segmentId) {
        const existing = segments.find(
          (segment): segment is Extract<AgentSegment, { kind: "text" }> =>
            segment.id === event.segmentId && segment.kind === "text",
        );
        if (existing) {
          return {
            ...message,
            agentSegments: upsertSegment(segments, {
              ...existing,
              isStreaming: false,
            }),
          };
        }
      }
      return message;
    }

    case "answer_delta": {
      content += event.delta;
      isThinkingStreaming = false;
      return {
        ...message,
        agentMode: agentMode || message.agentMode === true,
        content,
        isThinkingStreaming,
        isStreaming: true,
      };
    }

    case "tool_start": {
      agentMode = true;
      const toolSegment: AgentToolSegment = {
        kind: "tool",
        id: `tool-${event.toolCallId}`,
        toolCallId: event.toolCallId,
        name: event.name,
        status: "running",
        description: event.description,
        args: event.args,
        searchQuery:
          event.name === "web_search" && typeof event.args?.query === "string"
            ? event.args.query
            : undefined,
        startedAtMs: Date.now(),
      };
      return {
        ...message,
        agentMode,
        isThinkingStreaming: false,
        agentSegments: [...segments, toolSegment],
        isStreaming: true,
      };
    }

    case "tool_output_delta": {
      const index = segments.findIndex(
        (segment) =>
          segment.kind === "tool" && segment.toolCallId === event.toolCallId,
      );
      if (index === -1) return message;
      const tool = segments[index] as AgentToolSegment;
      const key = event.kind === "stderr" ? "stderr" : "stdout";
      const nextTool: AgentToolSegment = {
        ...tool,
        [key]: `${tool[key] ?? ""}${event.delta}`,
      };
      const nextSegments = [...segments];
      nextSegments[index] = nextTool;
      return { ...message, agentSegments: nextSegments, isStreaming: true };
    }

    case "tool_data": {
      const index = segments.findIndex(
        (segment) =>
          segment.kind === "tool" && segment.toolCallId === event.toolCallId,
      );
      if (index === -1) return message;
      const tool = segments[index] as AgentToolSegment;
      const results = Array.isArray(event.data.results)
        ? (event.data.results as WebSearchResult[])
        : tool.searchResults;
      const query =
        typeof event.data.query === "string"
          ? event.data.query
          : tool.searchQuery;
      const nextSegments = [...segments];
      nextSegments[index] = {
        ...tool,
        searchResults: results,
        searchQuery: query,
      };
      return { ...message, agentSegments: nextSegments, isStreaming: true };
    }

    case "tool_end": {
      const index = segments.findIndex(
        (segment) =>
          segment.kind === "tool" && segment.toolCallId === event.toolCallId,
      );
      if (index === -1) return message;
      const tool = segments[index] as AgentToolSegment;
      const nextSegments = [...segments];
      nextSegments[index] = enrichToolFromResult(tool, event.result);
      return { ...message, agentSegments: nextSegments, isStreaming: true };
    }

    case "step_done":
      return message;

    case "agent_frame_complete":
      return {
        ...message,
        agentMode: true,
        agentFrameComplete: true,
        isThinkingStreaming: false,
        agentSegments: finalizeStreamingSegments(segments),
        isStreaming: true,
      };

    case "done":
      return {
        ...message,
        isStreaming: false,
        isThinkingStreaming: false,
        agentFrameComplete: true,
        agentSegments: finalizeStreamingSegments(segments),
      };

    case "error":
      return {
        ...message,
        content: message.content || event.message,
        isStreaming: false,
        isThinkingStreaming: false,
        agentFrameComplete: true,
        agentSegments: finalizeStreamingSegments(segments),
      };

    default:
      return message;
  }
}
