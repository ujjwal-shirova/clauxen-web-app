import type { StreamEvent } from "@/lib/chat-stream";
import type {
  AgentSegment,
  AgentToolSegment,
  WebSearchResult,
} from "@/lib/agent-segments";
import type { ChatArtifact } from "@/lib/chat-artifacts";
import { fileNameFromPath } from "@/lib/chat-artifacts";
import {
  collectCreateFileArtifacts,
  mergeChatArtifacts,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import { enrichToolFromResult } from "@/lib/enrich-agent-tool";
import type { AgentFrame } from "@/lib/agent-frames";
import {
  activeFrameIndex,
  createAgentFrame,
  frameHasWorkSegments,
  frameHasToolSegments,
  hasActiveFrameWork,
  resolveAgentFrames,
  uniqueAgentFrameId,
} from "@/lib/agent-frames";
import type { Message } from "@/lib/types";
import { toUserFacingChatError } from "@/lib/assistant-generation-error";

type FrameReducerState = {
  message: Message;
  frames: AgentFrame[];
  frameIdx: number;
};

function initFrameState(message: Message): FrameReducerState {
  const frames = [...resolveAgentFrames(message)];
  const frameIdx = activeFrameIndex(message, frames);
  return { message, frames, frameIdx };
}

function ensureOpenFrame(state: FrameReducerState): FrameReducerState {
  const { frames } = state;
  const last = frames[frames.length - 1];
  if (frames.length === 0 || last?.complete) {
    const frameId = uniqueAgentFrameId(frames, `frame-${frames.length + 1}`);
    const next = createAgentFrame(frameId);
    return {
      ...state,
      frames: [...frames, next],
      frameIdx: frames.length,
    };
  }
  return state;
}

function finalizeFrame(frame: AgentFrame): AgentFrame {
  return {
    ...frame,
    complete: true,
    completedAtMs: Date.now(),
    segments: finalizeStreamingSegments(frame.segments),
  };
}

function finalizeAllFrames(frames: AgentFrame[]): AgentFrame[] {
  return frames.map((frame) => (frame.complete ? frame : finalizeFrame(frame)));
}

function syncFrameState(
  state: FrameReducerState,
  extra?: Partial<Message>,
): Message {
  const { frames, frameIdx, message } = state;
  const active = frames[frameIdx];
  const allComplete =
    frames.length > 0 && frames.every((frame) => frame.complete);
  return {
    ...message,
    ...extra,
    agentFrames: frames.length > 0 ? frames : message.agentFrames,
    activeAgentFrameIndex:
      frames.length > 0 ? frameIdx : message.activeAgentFrameIndex,
    agentSegments: active?.segments ?? message.agentSegments,
    agentFrameComplete: allComplete || message.agentFrameComplete === true,
  };
}

function withSegments(
  state: FrameReducerState,
  updater: (segments: AgentSegment[]) => AgentSegment[],
): FrameReducerState {
  const opened = ensureOpenFrame(state);
  const frame = opened.frames[opened.frameIdx];
  const nextSegments = updater(frame.segments);
  const frames = [...opened.frames];
  frames[opened.frameIdx] = { ...frame, segments: nextSegments };
  return { ...opened, frames };
}

function hasActiveAgentWork(state: FrameReducerState): boolean {
  return hasActiveFrameWork(state.frames, state.frameIdx);
}

function attachIntroNarrativeToFrame(
  frames: AgentFrame[],
  text: string,
  append = false,
): AgentFrame[] {
  if (!text.trim() || frames.length === 0) return frames;
  const next = [...frames];
  const lastIdx = next.length - 1;
  const last = next[lastIdx];
  const prior = last.introNarrative ?? "";
  next[lastIdx] = {
    ...last,
    introNarrative: append && prior ? `${prior}${text}` : text,
  };
  return next;
}

function attachInterimToLastFrame(
  frames: AgentFrame[],
  content: string,
): AgentFrame[] {
  if (!content.trim() || frames.length === 0) return frames;
  const next = [...frames];
  const lastIdx = next.length - 1;
  const last = next[lastIdx];
  const prior = last.interimOutput ?? "";

  // If the new content is a superset of the prior (streaming accumulation),
  // replace in place rather than appending with a separator. This keeps the
  // live narrative clean as post-tool text deltas arrive.
  const isAccumulation =
    prior.length > 0 && content.startsWith(prior.trim());

  next[lastIdx] = {
    ...last,
    interimOutput: isAccumulation
      ? content
      : prior.trim()
        ? `${prior.trim()}\n\n${content}`
        : content,
  };
  return next;
}

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

function upsertToolSegment(
  segments: AgentSegment[],
  tool: AgentToolSegment,
): AgentSegment[] {
  const index = segments.findIndex(
    (segment) =>
      segment.kind === "tool" && segment.toolCallId === tool.toolCallId,
  );
  if (index === -1) return [...segments, tool];
  const next = [...segments];
  next[index] = { ...next[index], ...tool } as AgentToolSegment;
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
    if (
      (segment.kind === "narration" || segment.kind === "text") &&
      segment.isStreaming
    ) {
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

function upsertArtifact(
  artifacts: ChatArtifact[] | undefined,
  event: Extract<StreamEvent, { type: "artifact_upsert" }>,
): ChatArtifact[] {
  const list = [...(artifacts ?? [])];
  const index = list.findIndex((row) => row.id === event.artifactId);
  const row: ChatArtifact = {
    id: event.artifactId,
    path: event.path,
    fileName: fileNameFromPath(event.path),
    content: event.content,
    language: event.language,
    description: event.description,
    createdAtMs: index >= 0 ? list[index].createdAtMs : Date.now(),
  };
  if (index >= 0) {
    list[index] = row;
  } else {
    list.push(row);
  }
  return list;
}

export function applyAgentStreamEvent(
  message: Message,
  event: StreamEvent,
): Message {
  let state = initFrameState(message);
  let thinkingContent = state.message.thinkingContent ?? "";
  let content = state.message.content ?? "";
  let hasThinking = state.message.hasThinking ?? false;
  let isThinkingStreaming = state.message.isThinkingStreaming ?? false;
  let agentMode = state.message.agentMode ?? false;
  let agentArtifacts = state.message.agentArtifacts;

  switch (event.type) {
    case "start":
      return {
        ...message,
        generationFailed: false,
        agentMode: event.agentMode === true,
        agentSegments: event.agentMode === true ? [] : message.agentSegments,
        agentFrames: event.agentMode === true ? [] : message.agentFrames,
        activeAgentFrameIndex:
          event.agentMode === true ? undefined : message.activeAgentFrameIndex,
        agentArtifacts: event.agentMode === true ? [] : message.agentArtifacts,
        agentFrameComplete: false,
        isStreaming: true,
      };

    case "agent_frame_start": {
      let frames = [...state.frames];
      const existingIndex = frames.findIndex(
        (frame) => frame.id === event.frameId && !frame.complete,
      );
      if (existingIndex >= 0) {
        state = {
          ...state,
          frames,
          frameIdx: existingIndex,
        };
        return syncFrameState(state, {
          agentMode: true,
          agentFrameComplete: false,
          isStreaming: true,
        });
      }

      if (frames.length > 0) {
        const lastIdx = frames.length - 1;
        const last = frames[lastIdx];
        if (!last.complete) {
          frames[lastIdx] = finalizeFrame(last);
        }
      }
      const frameId = uniqueAgentFrameId(frames, event.frameId);
      frames.push(createAgentFrame(frameId));
      state = {
        ...state,
        frames,
        frameIdx: frames.length - 1,
      };
      return syncFrameState(state, {
        agentMode: true,
        agentFrameComplete: false,
        isStreaming: true,
      });
    }

    case "segment_start":
      agentMode = true;
      if (event.kind === "thinking") {
        hasThinking = true;
        isThinkingStreaming = true;
        state = withSegments(state, (segments) =>
          upsertSegment(segments, {
            kind: "thinking",
            id: event.segmentId,
            content: "",
            isStreaming: true,
            startedAtMs: Date.now(),
          }),
        );
        return syncFrameState(state, {
          agentMode,
          hasThinking,
          isThinkingStreaming,
          thinkingStartedAtMs:
            state.message.thinkingStartedAtMs ?? Date.now(),
        });
      }
      if (event.kind === "narration" || event.kind === "text") {
        const narrationKind = event.kind;
        agentMode = true;
        state = withSegments(state, (segments) =>
          upsertSegment(segments, {
            kind: narrationKind,
            id: event.segmentId,
            content: "",
            isStreaming: true,
          }),
        );
        return syncFrameState(state, { agentMode, isStreaming: true });
      }
      return message;

    case "thinking_heading": {
      agentMode = true;
      state = withSegments(state, (segments) => {
        const existing = segments.find(
          (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
            segment.id === event.segmentId && segment.kind === "thinking",
        );
        if (!existing) return segments;
        return upsertSegment(segments, {
          ...existing,
          heading: event.heading,
        });
      });
      return syncFrameState(state, { agentMode, isStreaming: true });
    }

    case "thinking_start":
      hasThinking = true;
      isThinkingStreaming = true;
      return syncFrameState(state, {
        hasThinking,
        isThinkingStreaming,
        thinkingStartedAtMs: state.message.thinkingStartedAtMs ?? Date.now(),
        isStreaming: true,
      });

    case "thinking_delta": {
      thinkingContent += event.delta;
      hasThinking = true;
      if (event.segmentId) {
        const segmentId = event.segmentId;
        agentMode = true;
        state = withSegments(state, (segments) => {
          const existing = segments.find(
            (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
              segment.id === segmentId && segment.kind === "thinking",
          );
          return upsertSegment(segments, {
            kind: "thinking",
            id: segmentId,
            heading: existing?.heading,
            content: `${existing?.content ?? ""}${event.delta}`,
            isStreaming: true,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          });
        });
        return syncFrameState(state, {
          agentMode,
          thinkingContent,
          hasThinking,
          isThinkingStreaming: true,
          isStreaming: true,
        });
      }
      if (state.frames.length > 0) {
        state = withSegments(state, (segments) => {
          const frame = state.frames[state.frameIdx];
          const segmentId = `${frame?.id ?? "frame"}-thinking`;
          const existing = segments.find(
            (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
              segment.id === segmentId && segment.kind === "thinking",
          );
          return upsertSegment(segments, {
            kind: "thinking",
            id: segmentId,
            heading: existing?.heading,
            content: `${existing?.content ?? ""}${event.delta}`,
            isStreaming: true,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          });
        });
      }
      return syncFrameState(state, {
        thinkingContent,
        hasThinking,
        isThinkingStreaming: true,
        thinkingStartedAtMs: state.message.thinkingStartedAtMs ?? Date.now(),
        isStreaming: true,
      });
    }

    case "text_delta":
    case "narration_delta": {
      agentMode = true;
      const segmentKind =
        event.type === "narration_delta" ? "narration" : "text";
      state = withSegments(state, (segments) => {
        const existing = segments.find(
          (
            segment,
          ): segment is Extract<
            AgentSegment,
            { kind: "narration" | "text" }
          > =>
            segment.id === event.segmentId &&
            (segment.kind === "narration" || segment.kind === "text"),
        );
        return upsertSegment(segments, {
          kind: existing?.kind ?? segmentKind,
          id: event.segmentId,
          content: `${existing?.content ?? ""}${event.delta}`,
          isStreaming: true,
        });
      });
      return syncFrameState(state, { agentMode, isStreaming: true });
    }

    case "thinking_end":
    case "segment_end": {
      const isThinkingSegment =
        event.type === "thinking_end" ||
        (event.type === "segment_end" && event.kind === "thinking");
      if (isThinkingSegment) {
        isThinkingStreaming = false;
        if (event.segmentId) {
          let endedDurationSeconds: number | undefined;
          state = withSegments(state, (segments) => {
            const existing = segments.find(
              (segment): segment is Extract<AgentSegment, { kind: "thinking" }> =>
                segment.id === event.segmentId && segment.kind === "thinking",
            );
            if (!existing) return segments;
            const durationSeconds = existing.startedAtMs
              ? Math.max(
                  1,
                  Math.round((Date.now() - existing.startedAtMs) / 1000),
                )
              : existing.durationSeconds;
            endedDurationSeconds = durationSeconds;
            return upsertSegment(segments, {
              ...existing,
              isStreaming: false,
              durationSeconds,
            });
          });
          return syncFrameState(state, {
            isThinkingStreaming: false,
            thinkingDurationSeconds:
              endedDurationSeconds ?? state.message.thinkingDurationSeconds,
          });
        }
        if (state.frames.length > 0) {
          let longestDurationSeconds = state.message.thinkingDurationSeconds;
          state = withSegments(state, (segments) => {
            const next = segments.map((segment) => {
              if (segment.kind !== "thinking" || !segment.isStreaming) {
                return segment;
              }
              const durationSeconds = segment.startedAtMs
                ? Math.max(
                    1,
                    Math.round((Date.now() - segment.startedAtMs) / 1000),
                  )
                : segment.durationSeconds;
              if (durationSeconds) {
                longestDurationSeconds = Math.max(
                  longestDurationSeconds ?? 0,
                  durationSeconds,
                );
              }
              return { ...segment, isStreaming: false, durationSeconds };
            });
            return next;
          });
          return syncFrameState(state, {
            isThinkingStreaming: false,
            thinkingDurationSeconds: longestDurationSeconds,
          });
        }
        const plainDurationSeconds = state.message.thinkingStartedAtMs
          ? Math.max(
              1,
              Math.round((Date.now() - state.message.thinkingStartedAtMs) / 1000),
            )
          : state.message.thinkingDurationSeconds;
        return syncFrameState(state, {
          isThinkingStreaming: false,
          thinkingDurationSeconds: plainDurationSeconds,
        });
      }
      if (
        event.type === "segment_end" &&
        (event.kind === "narration" || event.kind === "text") &&
        event.segmentId
      ) {
        state = withSegments(state, (segments) => {
          const existing = segments.find(
            (
              segment,
            ): segment is Extract<
              AgentSegment,
              { kind: "narration" | "text" }
            > =>
              segment.id === event.segmentId &&
              (segment.kind === "narration" || segment.kind === "text"),
          );
          if (!existing) return segments;
          return upsertSegment(segments, {
            ...existing,
            isStreaming: false,
          });
        });
        return syncFrameState(state);
      }
      return message;
    }

    case "segment_remove": {
      if (state.frames.length === 0) return message;
      state = withSegments(state, (segments) =>
        segments.filter((segment) => segment.id !== event.segmentId),
      );
      return syncFrameState(state);
    }

    case "answer_clear":
      return syncFrameState(state, {
        content: "",
        agentFrameComplete: false,
        isStreaming: true,
      });

    case "answer_delta": {
      content += event.delta;
      isThinkingStreaming = false;
      if (message.id) {
        agentArtifacts = mergeChatArtifacts(
          agentArtifacts,
          collectCreateFileArtifacts(content, message.id),
        );
      }
      return syncFrameState(state, {
        agentMode: agentMode || state.message.agentMode === true,
        content,
        agentArtifacts,
        isThinkingStreaming,
        isStreaming: true,
      });
    }

    case "tool_start": {
      agentMode = true;
      state = withSegments(state, (segments) => {
        const existingTool = segments.find(
          (segment): segment is AgentToolSegment =>
            segment.kind === "tool" && segment.toolCallId === event.toolCallId,
        );
        const mergedArgs = { ...existingTool?.args, ...event.args };
        const nextSearchQuery =
          event.name === "web_search" && typeof mergedArgs.query === "string"
            ? mergedArgs.query
            : existingTool?.searchQuery;
        const toolSegment: AgentToolSegment = {
          kind: "tool",
          id: existingTool?.id ?? `tool-${event.toolCallId}`,
          toolCallId: event.toolCallId,
          name: event.name,
          status: "running",
          description: event.description ?? existingTool?.description,
          args: mergedArgs,
          argsComplete: event.argsComplete ?? existingTool?.argsComplete,
          searchQuery: nextSearchQuery,
          searchResults: existingTool?.searchResults,
          filePath:
            (event.name === "create_file" || event.name === "file_write") &&
            typeof mergedArgs.path === "string"
              ? mergedArgs.path
              : existingTool?.filePath,
          fileContent:
            (event.name === "create_file" || event.name === "file_write") &&
            typeof mergedArgs.content === "string"
              ? mergedArgs.content
              : typeof mergedArgs.file_text === "string"
                ? mergedArgs.file_text
                : existingTool?.fileContent,
          fileLanguage: existingTool?.fileLanguage,
          startedAtMs: existingTool?.startedAtMs ?? Date.now(),
        };
        if (toolSegment.filePath && !toolSegment.fileLanguage) {
          toolSegment.fileLanguage = inferLanguageFromPath(toolSegment.filePath);
        }
        return upsertToolSegment(segments, toolSegment);
      });
      return syncFrameState(state, {
        agentMode,
        content,
        agentFrameComplete: false,
        isThinkingStreaming: false,
        isStreaming: true,
      });
    }

    case "tool_output_delta": {
      state = withSegments(state, (segments) => {
        const index = segments.findIndex(
          (segment) =>
            segment.kind === "tool" && segment.toolCallId === event.toolCallId,
        );
        if (index === -1) return segments;
        const tool = segments[index] as AgentToolSegment;
        const key = event.kind === "stderr" ? "stderr" : "stdout";
        const nextTool: AgentToolSegment = {
          ...tool,
          [key]: `${tool[key] ?? ""}${event.delta}`,
        };
        const nextSegments = [...segments];
        nextSegments[index] = nextTool;
        return nextSegments;
      });
      return syncFrameState(state, { isStreaming: true });
    }

    case "tool_data": {
      state = withSegments(state, (segments) => {
        const index = segments.findIndex(
          (segment) =>
            segment.kind === "tool" && segment.toolCallId === event.toolCallId,
        );
        if (index === -1) return segments;
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
          args: { ...tool.args, query },
        };
        return nextSegments;
      });
      return syncFrameState(state, { isStreaming: true });
    }

    case "tool_end": {
      state = withSegments(state, (segments) => {
        const index = segments.findIndex(
          (segment) =>
            segment.kind === "tool" && segment.toolCallId === event.toolCallId,
        );
        if (index === -1) return segments;
        const tool = segments[index] as AgentToolSegment;
        const nextSegments = [...segments];
        nextSegments[index] = {
          ...enrichToolFromResult(tool, event.result),
          ...(event.isError ? { status: "error" as const } : {}),
        };
        return nextSegments;
      });
      return syncFrameState(state, { isStreaming: true });
    }

    case "artifact_upsert": {
      agentArtifacts = upsertArtifact(agentArtifacts, event);
      state = withSegments(state, (segments) => {
        const toolIndex = segments.findIndex(
          (segment) =>
            segment.kind === "tool" &&
            (segment.name === "create_file" ||
              segment.name === "present_files" ||
              segment.name === "file_write") &&
            segment.status === "running",
        );
        if (toolIndex < 0) return segments;
        const tool = segments[toolIndex] as AgentToolSegment;
        const nextSegments = [...segments];
        nextSegments[toolIndex] = {
          ...tool,
          filePath: event.path,
          fileContent: event.content,
          fileLanguage: event.language,
        };
        return nextSegments;
      });
      return syncFrameState(state, { agentArtifacts, isStreaming: true });
    }

    case "step_done":
      state = withSegments(state, (segments) =>
        upsertSegment(segments, {
          kind: "step_done",
          id: `step-done-${Date.now()}`,
          label: event.label,
        }),
      );
      return syncFrameState(state, { isStreaming: true });

    case "agent_interim": {
      const frames = attachInterimToLastFrame(state.frames, event.text);
      state = { ...state, frames };
      return syncFrameState(state, {
        agentMode: true,
        isStreaming: true,
      });
    }

    case "agent_intro_narrative_delta": {
      agentMode = true;
      state = ensureOpenFrame(state);
      const frames = attachIntroNarrativeToFrame(
        state.frames,
        event.delta,
        true,
      );
      state = { ...state, frames };
      return syncFrameState(state, {
        agentMode,
        isStreaming: true,
      });
    }

    case "agent_intro_narrative": {
      agentMode = true;
      state = ensureOpenFrame(state);
      const frames = attachIntroNarrativeToFrame(
        state.frames,
        event.text,
        false,
      );
      state = { ...state, frames };
      return syncFrameState(state, {
        agentMode,
        isStreaming: true,
      });
    }

    case "agent_frame_complete": {
      state = ensureOpenFrame(state);
      const frames = [...state.frames];
      const idx = state.frameIdx;
      const frame = frames[idx];
      if (frame) {
        const frameId = event.frameId
          ? uniqueAgentFrameId(frames, event.frameId, idx)
          : frame.id;
        frames[idx] = finalizeFrame({
          ...frame,
          id: frameId,
        });
        state = {
          ...state,
          frames,
        };
      }
      return syncFrameState(state, {
        agentMode: true,
        isThinkingStreaming: false,
        isStreaming: true,
      });
    }

    case "done": {
      const frames = finalizeAllFrames(state.frames);
      state = { ...state, frames };
      if (message.id) {
        agentArtifacts = mergeChatArtifacts(
          agentArtifacts,
          collectCreateFileArtifacts(content, message.id),
        );
      }

      let thinkingDurationSeconds = state.message.thinkingDurationSeconds;
      if (!thinkingDurationSeconds && state.message.thinkingStartedAtMs) {
        thinkingDurationSeconds = Math.max(
          1,
          Math.round((Date.now() - state.message.thinkingStartedAtMs) / 1000),
        );
      }
      if (!thinkingDurationSeconds) {
        for (const frame of frames) {
          for (const segment of frame.segments) {
            if (segment.kind !== "thinking" || !segment.durationSeconds) {
              continue;
            }
            thinkingDurationSeconds = Math.max(
              thinkingDurationSeconds ?? 0,
              segment.durationSeconds,
            );
          }
        }
      }

      return syncFrameState(state, {
        agentArtifacts,
        isStreaming: false,
        isThinkingStreaming: false,
        agentFrameComplete: true,
        thinkingDurationSeconds,
      });
    }

    case "error": {
      const frames = finalizeAllFrames(state.frames);
      state = { ...state, frames };
      return syncFrameState(state, {
        content:
          state.message.content?.trim()
            ? toUserFacingChatError(state.message.content)
            : toUserFacingChatError(event.message),
        isStreaming: false,
        isThinkingStreaming: false,
        agentFrameComplete: true,
        generationFailed: true,
      });
    }

    default:
      return message;
  }
}

/** Handle early tool streaming events from the agent bridge. */
export function applyToolStreamingEvent(
  message: Message,
  payload: {
    tool_calls?: Array<{
      id?: string;
      name?: string;
      input?: string;
    }>;
  },
): Message {
  const tool = payload.tool_calls?.[0];
  const toolId = tool?.id;
  const toolName = tool?.name;
  if (!toolId || !toolName) return message;

  const args = parsePartialToolInput(tool.input);
  let state = initFrameState(message);
  state = withSegments(state, (segments) => {
    const existing = segments.find(
      (segment): segment is AgentToolSegment =>
        segment.kind === "tool" && segment.toolCallId === toolId,
    );
    const toolSegment: AgentToolSegment = {
      kind: "tool",
      id: existing?.id ?? `tool-${toolId}`,
      toolCallId: toolId,
      name: toolName,
      status: existing?.status ?? "running",
      args: { ...existing?.args, ...args },
      searchQuery:
        tool.name === "web_search" && typeof args.query === "string"
          ? args.query
          : existing?.searchQuery,
      startedAtMs: existing?.startedAtMs ?? Date.now(),
    };
    return upsertToolSegment(segments, toolSegment);
  });

  return syncFrameState(state, {
    agentMode: true,
    isStreaming: true,
  });
}
