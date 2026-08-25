import type { StreamEvent } from "@/lib/chat-stream";
import type {
  AgentNarrationStep,
  AgentStep,
  AgentThinkingStep,
  AgentToolStep,
} from "@/lib/agent-trace";
import type { Message } from "@/lib/types";
import type { ChatArtifact } from "@/lib/chat-artifacts";
import { fileNameFromPath } from "@/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/lib/create-file-tags";
import { enrichToolFromResult } from "@/lib/enrich-agent-tool";
import { toUserFacingChatError } from "@/lib/assistant-generation-error";

/**
 * Agent trace reducer — folds SSE protocol events into Message.agentTrace.
 *
 * One flat ordered step list per turn:
 *   thinking   — interleaved provider reasoning with duration
 *   narration  — first-person progress prose; final round is promoted to the
 *                durable answer via answer_finalize (in place, no teleport)
 *   tool       — tool/connector lifecycle with streaming stdout/search hits
 *
 * The Working-for timer reads trace.startedAtMs; the trailing shimmer row
 * renders while any step is live.
 */

type TracePatch = Partial<
  Pick<
    Message,
    | "agentTrace"
    | "agentMode"
    | "content"
    | "thinkingContent"
    | "hasThinking"
    | "isThinkingStreaming"
    | "thinkingStartedAtMs"
    | "thinkingDurationSeconds"
    | "isStreaming"
    | "agentFrameComplete"
    | "generationFailed"
    | "agentArtifacts"
  >
>;

function upsertStep(steps: AgentStep[], step: AgentStep): AgentStep[] {
  const index = steps.findIndex((item) => item.id === step.id);
  if (index === -1) return [...steps, step];
  const next = [...steps];
  next[index] = step;
  return next;
}

function patchTool(
  steps: AgentStep[],
  toolCallId: string,
  updater: (tool: AgentToolStep) => AgentToolStep,
): AgentStep[] {
  const index = steps.findIndex(
    (step) => step.kind === "tool" && step.toolCallId === toolCallId,
  );
  if (index === -1) return steps;
  const next = [...steps];
  next[index] = updater(steps[index] as AgentToolStep);
  return next;
}

function finalizeStreamingSteps(steps: AgentStep[], now: number): AgentStep[] {
  return steps.map((step) => {
    if (step.kind === "thinking" && step.isStreaming) {
      const durationSeconds = step.startedAtMs
        ? Math.max(1, Math.round((now - step.startedAtMs) / 1000))
        : step.durationSeconds;
      return { ...step, isStreaming: false, durationSeconds };
    }
    if (step.kind === "narration" && step.isStreaming) {
      return { ...step, isStreaming: false };
    }
    if (step.kind === "tool" && step.status === "running") {
      return { ...step, status: "done", completedAtMs: now };
    }
    return step;
  });
}

function completeTrace(message: Message, extra?: TracePatch): Message {
  const trace = message.agentTrace;
  const now = Date.now();
  return {
    ...message,
    ...extra,
    agentTrace:
      trace && !trace.complete
        ? {
            ...trace,
            steps: finalizeStreamingSteps(trace.steps, now),
            complete: true,
            completedAtMs: now,
          }
        : trace,
    agentFrameComplete: true,
  };
}

export function applyAgentStreamEvent(
  message: Message,
  event: StreamEvent,
): Message {
  switch (event.type) {
    case "start":
      return {
        ...message,
        generationFailed: false,
        agentMode: event.agentMode === true,
        agentTrace:
          event.agentMode === true
            ? { steps: [], startedAtMs: Date.now() }
            : message.agentTrace,
        agentFrameComplete: false,
        isStreaming: true,
      };

    case "turn_ready":
      return message;

    case "thinking_start": {
      if (!message.agentMode) return message;
      const segmentId = event.segmentId ?? `think-${Date.now()}`;
      const steps = message.agentTrace?.steps ?? [];
      const existing = steps.find(
        (step): step is AgentThinkingStep =>
          step.kind === "thinking" && step.id === segmentId,
      );
      return {
        ...message,
        hasThinking: true,
        isThinkingStreaming: true,
        thinkingStartedAtMs: message.thinkingStartedAtMs ?? Date.now(),
        agentTrace: {
          ...(message.agentTrace ?? { steps: [], startedAtMs: Date.now() }),
          steps: upsertStep(steps, {
            kind: "thinking",
            id: existing?.id ?? segmentId,
            content: existing?.content,
            isStreaming: true,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          }),
        },
        isStreaming: true,
      };
    }

    case "thinking_delta": {
      let next = message;
      if (!next.hasThinking || !next.isThinkingStreaming) {
        next = applyAgentStreamEvent(message, {
          type: "thinking_start",
          segmentId: event.segmentId,
        });
      } else if (
        event.segmentId &&
        !(next.agentTrace?.steps ?? []).some(
          (step) => step.id === event.segmentId,
        )
      ) {
        next = applyAgentStreamEvent(message, {
          type: "thinking_start",
          segmentId: event.segmentId,
        });
      }
      if (!next.agentMode || !event.delta) return next;
      const steps = next.agentTrace?.steps ?? [];
      const targetId =
        event.segmentId ??
        [...steps].reverse().find((step) => step.kind === "thinking")?.id;
      if (!targetId) return next;
      return {
        ...next,
        agentTrace: {
          ...(next.agentTrace ?? { steps: [], startedAtMs: Date.now() }),
          steps: steps.map((step) =>
            step.kind === "thinking" && step.id === targetId
              ? { ...step, content: `${step.content ?? ""}${event.delta}` }
              : step,
          ),
        },
      };
    }

    case "thinking_end": {
      if (!message.agentTrace) return message;
      const now = Date.now();
      let durationSeconds: number | undefined;
      const steps = event.segmentId
        ? patchToollessThinking(
            message.agentTrace.steps,
            event.segmentId,
            now,
            (d) => {
              durationSeconds = d;
            },
          )
        : message.agentTrace.steps.map((step) => {
            if (step.kind !== "thinking" || !step.isStreaming) return step;
            const d = step.startedAtMs
              ? Math.max(1, Math.round((now - step.startedAtMs) / 1000))
              : undefined;
            if (d) durationSeconds = d;
            return { ...step, isStreaming: false, durationSeconds: d };
          });
      return {
        ...message,
        isThinkingStreaming: false,
        thinkingDurationSeconds:
          durationSeconds ?? message.thinkingDurationSeconds,
        agentTrace: { ...message.agentTrace, steps },
      };
    }

    case "narration_delta":
    case "text_delta": {
      if (!message.agentMode) return message;
      const visibleDelta = event.delta;
      if (!visibleDelta) return message;
      const steps = message.agentTrace?.steps ?? [];
      const existing = steps.find(
        (step): step is AgentNarrationStep =>
          step.kind === "narration" && step.id === event.segmentId,
      );
      const nextContent = `${existing?.content ?? ""}${visibleDelta}`;
      const deltaCount = (existing?.deltaCount ?? 0) + 1;
      let mirroredContent: string | null = null;
      const nextSteps = upsertStep(steps, {
        kind: "narration",
        id: event.segmentId,
        content: nextContent,
        deltaCount,
        isStreaming: true,
        isFinal: existing?.isFinal,
        startedAtMs: existing?.startedAtMs ?? Date.now(),
      });
      // Paint the very first provider chunk as answer-like prose. If a tool
      // call follows, tool_start clears this optimistic candidate and the same
      // narration remains in its interleaved transcript position. Waiting for
      // a second chunk made single-delta provider responses appear all at once
      // only when answer_finalize landed.
      const hasLiveWork = nextSteps.some(
        (step) =>
          (step.kind === "tool" && step.status === "running") ||
          (step.kind === "thinking" && step.isStreaming === true),
      );
      if (!hasLiveWork) {
        mirroredContent = nextContent;
      }
      return {
        ...message,
        agentMode: true,
        content: mirroredContent ?? message.content,
        isThinkingStreaming: false,
        isStreaming: true,
        agentTrace: {
          ...(message.agentTrace ?? { steps: [], startedAtMs: Date.now() }),
          steps: nextSteps,
        },
      };
    }

    case "segment_start": {
      if (!message.agentMode) return message;
      if (event.kind === "thinking") {
        return applyAgentStreamEvent(message, {
          type: "thinking_start",
          segmentId: event.segmentId,
        });
      }
      if (event.kind === "narration") {
        const steps = message.agentTrace?.steps ?? [];
        const existing = steps.find(
          (step): step is AgentNarrationStep =>
            step.kind === "narration" && step.id === event.segmentId,
        );
        if (!existing) {
          return {
            ...message,
            agentMode: true,
            isStreaming: true,
            agentTrace: {
              ...(message.agentTrace ?? { steps: [], startedAtMs: Date.now() }),
              steps: upsertStep(steps, {
                kind: "narration",
                id: event.segmentId,
                content: "",
                deltaCount: 0,
                isStreaming: true,
                startedAtMs: Date.now(),
              }),
            },
          };
        }
      }
      return message;
    }

    case "segment_end": {
      if (!message.agentTrace) return message;
      if (event.kind === "thinking") {
        return applyAgentStreamEvent(message, {
          type: "thinking_end",
          segmentId: event.segmentId,
        });
      }
      if (event.kind === "narration") {
        return {
          ...message,
          agentTrace: {
            ...message.agentTrace,
            steps: message.agentTrace.steps.map((step) =>
              step.kind === "narration" && step.id === event.segmentId
                ? { ...step, isStreaming: false }
                : step,
            ),
          },
        };
      }
      return message;
    }

    case "answer_finalize": {
      const text = event.text.trim();
      if (!text) return message;
      const now = Date.now();
      const steps = message.agentTrace?.steps ?? [];
      const nextSteps = event.segmentId
        ? steps.map((step) =>
            step.kind === "narration" && step.id === event.segmentId
              ? { ...step, content: text, isStreaming: false, isFinal: true }
              : step,
          )
        : steps;
      return {
        ...message,
        content: text,
        isThinkingStreaming: false,
        isStreaming: true,
        agentTrace:
          message.agentTrace && nextSteps.length > 0
            ? {
                ...message.agentTrace,
                steps: finalizeStreamingSteps(nextSteps, now),
                complete: true,
                completedAtMs: message.agentTrace.completedAtMs ?? now,
              }
            : message.agentTrace,
      };
    }

    case "answer_delta":
      return {
        ...message,
        content: message.content + event.delta,
        isThinkingStreaming: false,
        isStreaming: true,
      };

    case "tool_start": {
      const steps = message.agentTrace?.steps ?? [];
      const existing = steps.find(
        (step): step is AgentToolStep =>
          step.kind === "tool" && step.toolCallId === event.toolCallId,
      );
      const mergedArgs = { ...existing?.args, ...event.args };
      // Pre-tool narration may have been mirrored into content. Clear it so
      // interim prose does not flash as the final answer above the tool row.
      let content = message.content;
      const lastNarration = [...steps]
        .reverse()
        .find((step) => step.kind === "narration");
      if (
        content.trim() &&
        lastNarration?.kind === "narration" &&
        content.trim() === lastNarration.content.trim()
      ) {
        content = "";
      }
      const filePath =
        (event.name === "create_file" || event.name === "file_write") &&
        typeof mergedArgs.path === "string"
          ? mergedArgs.path
          : existing?.filePath;
      const fileContent =
        (event.name === "create_file" || event.name === "file_write") &&
        (typeof mergedArgs.content === "string"
          ? mergedArgs.content
          : typeof mergedArgs.file_text === "string"
            ? mergedArgs.file_text
            : undefined)
          ? ((typeof mergedArgs.content === "string"
              ? mergedArgs.content
              : mergedArgs.file_text) as string)
          : existing?.fileContent;
      return {
        ...message,
        agentMode: true,
        content,
        isThinkingStreaming: false,
        isStreaming: true,
        agentFrameComplete: false,
        agentTrace: {
          ...(message.agentTrace ?? { steps: [], startedAtMs: Date.now() }),
          steps: upsertStep(steps, {
            kind: "tool",
            id: existing?.id ?? `tool-${event.toolCallId}`,
            toolCallId: event.toolCallId,
            name: event.name,
            status: existing?.status === "done" ? existing.status : "running",
            description: event.description ?? existing?.description,
            args:
              Object.keys(mergedArgs).length > 0 ? mergedArgs : existing?.args,
            argsComplete: event.argsComplete ?? existing?.argsComplete,
            searchQuery:
              event.name === "web_search" &&
              typeof mergedArgs.query === "string"
                ? mergedArgs.query
                : existing?.searchQuery,
            searchResults: existing?.searchResults,
            filePath,
            fileContent,
            fileLanguage:
              filePath && !existing?.fileLanguage
                ? inferLanguageFromPath(filePath)
                : existing?.fileLanguage,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          }),
        },
      };
    }

    case "tool_output_delta": {
      if (!message.agentTrace) return message;
      const key = event.kind === "stderr" ? "stderr" : "stdout";
      return {
        ...message,
        isStreaming: true,
        agentTrace: {
          ...message.agentTrace,
          steps: patchTool(
            message.agentTrace.steps,
            event.toolCallId,
            (tool) => ({
              ...tool,
              [key]: `${tool[key] ?? ""}${event.delta}`,
            }),
          ),
        },
      };
    }

    case "tool_data": {
      if (!message.agentTrace) return message;
      return {
        ...message,
        isStreaming: true,
        agentTrace: {
          ...message.agentTrace,
          steps: patchTool(
            message.agentTrace.steps,
            event.toolCallId,
            (tool) => {
              const results = Array.isArray(event.data.results)
                ? (event.data.results as AgentToolStep["searchResults"])
                : tool.searchResults;
              const query =
                typeof event.data.query === "string"
                  ? event.data.query
                  : tool.searchQuery;
              return {
                ...tool,
                searchQuery: query,
                searchResults: results ?? tool.searchResults,
                args: query ? { ...tool.args, query } : tool.args,
              };
            },
          ),
        },
      };
    }

    case "tool_end": {
      if (!message.agentTrace) return message;
      return {
        ...message,
        isStreaming: true,
        agentTrace: {
          ...message.agentTrace,
          steps: patchTool(
            message.agentTrace.steps,
            event.toolCallId,
            (tool) => ({
              ...enrichToolFromResult(tool, event.result),
              ...(event.isError ? { status: "error" as const } : {}),
            }),
          ),
        },
      };
    }

    case "artifact_upsert": {
      const list = [...(message.agentArtifacts ?? [])];
      const index = list.findIndex((row) => row.id === event.artifactId);
      const row: ChatArtifact = {
        id: event.artifactId,
        path: event.path,
        fileName: fileNameFromPath(event.path),
        content: event.content,
        language: event.language,
        description: event.description,
        fileId: event.fileId,
        storagePath: event.storagePath,
        mimeType: event.mimeType,
        sizeBytes: event.sizeBytes,
        createdAtMs: index >= 0 ? list[index].createdAtMs : Date.now(),
      };
      if (index >= 0) list[index] = row;
      else list.push(row);
      let steps = message.agentTrace?.steps;
      if (steps) {
        const toolIndex = steps.findIndex(
          (step) =>
            step.kind === "tool" &&
            (step.name === "create_file" ||
              step.name === "present_files" ||
              step.name === "file_write") &&
            step.status === "running",
        );
        if (toolIndex >= 0) {
          const next = [...steps];
          const tool = next[toolIndex] as AgentToolStep;
          next[toolIndex] = {
            ...tool,
            filePath: event.path,
            fileContent: event.content,
            fileLanguage: event.language,
          };
          steps = next;
        }
      }
      return {
        ...message,
        agentArtifacts: list,
        isStreaming: true,
        agentTrace: steps
          ? { ...(message.agentTrace ?? { steps }), steps }
          : message.agentTrace,
      };
    }

    case "chat_title":
      return message;

    case "error":
      return completeTrace(message, { generationFailed: false });

    case "done":
      return completeTrace(message);

    default:
      return message;
  }
}

function patchToollessThinking(
  steps: AgentStep[],
  segmentId: string,
  now: number,
  onDuration: (durationSeconds: number | undefined) => void,
): AgentStep[] {
  return steps.map((step) => {
    if (step.kind !== "thinking" || step.id !== segmentId) return step;
    const durationSeconds = step.startedAtMs
      ? Math.max(1, Math.round((now - step.startedAtMs) / 1000))
      : step.durationSeconds;
    onDuration(durationSeconds);
    return { ...step, isStreaming: false, durationSeconds };
  });
}

/** User-facing error text for a failed assistant turn's answer body. */
export function agentTraceErrorText(message: string): string {
  return toUserFacingChatError(message);
}
