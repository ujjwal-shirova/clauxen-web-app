import type { Message } from "@/frontend/lib/types";
import type { AgentFrame } from "@/frontend/lib/agent-frames";
import type { AgentSegment, AgentToolSegment } from "@/frontend/lib/agent-segments";
import { enrichPersistedToolSegment } from "@/frontend/lib/enrich-agent-tool";
import type {
  TranscriptContentPart,
  TranscriptMessageRecord,
} from "@/backend/training/transcript-format";

function enrichSegments(segments: AgentSegment[]): AgentSegment[] {
  return segments.map((segment) => {
    if (segment.kind !== "tool") return segment;
    return enrichPersistedToolSegment(segment);
  });
}

function enrichMessageAgentUi(message: Message): Message {
  const frames = message.agentFrames?.map((frame) => ({
    ...frame,
    segments: enrichSegments(frame.segments),
  }));
  const segments = message.agentSegments
    ? enrichSegments(message.agentSegments)
    : frames?.[0]?.segments;
  if (!frames && !segments) return message;
  return {
    ...message,
    agentFrames: frames ?? message.agentFrames,
    agentSegments: segments ?? message.agentSegments,
  };
}

/**
 * Hydrate a UI Message from chat_messages.content_json when it is an
 * Anthropic Messages-style transcript record
 * (`{ role, message: { content: [...] } }`).
 */
export function hydrateMessageFromContentJson(
  base: Message,
  contentJson: unknown,
): Message {
  if (!contentJson || typeof contentJson !== "object") return base;
  const record = contentJson as Partial<TranscriptMessageRecord>;
  if (!record.message || !Array.isArray(record.message.content)) return base;

  const parts = record.message.content as TranscriptContentPart[];
  const agentUi = record.agent_ui;
  const persistedActions = Array.isArray(agentUi?.actions)
    ? agentUi.actions
    : [];
  let thinking = base.thinkingContent ?? "";
  const tools: AgentToolSegment[] = [];
  const texts: string[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "thinking" && typeof part.thinking === "string") {
      thinking = part.thinking;
      continue;
    }
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
      continue;
    }
    if (part.type === "tool_use" && typeof part.name === "string") {
      const id =
        typeof part.id === "string" && part.id
          ? part.id
          : `tool-${tools.length + 1}`;
      const action = persistedActions.find((candidate) => candidate?.id === id);
      const resultPart = parts.find(
        (candidate) =>
          candidate?.type === "tool_result" &&
          candidate.tool_use_id === id,
      );
      tools.push(
        enrichPersistedToolSegment({
          kind: "tool",
          id,
          toolCallId: id,
          name: part.name,
          status: action?.isError ? "error" : "done",
          args:
            part.input && typeof part.input === "object"
              ? (part.input as Record<string, unknown>)
              : action?.input ?? {},
          result:
            action?.result ??
            (resultPart && resultPart.type === "tool_result"
              ? resultPart.content
              : undefined),
          description: action?.description,
          startedAtMs: action?.startedAtMs,
          completedAtMs: action?.completedAtMs,
        }),
      );
    }
  }

  const contentFromParts = texts.join("\n\n").trim();
  const content = contentFromParts || base.content;
  const hasThinking = Boolean(thinking.trim());
  const hasTools = tools.length > 0;

  if (!hasThinking && !hasTools && !contentFromParts) return base;

  const stamp =
    typeof agentUi?.startedAtMs === "number" && agentUi.startedAtMs > 0
      ? agentUi.startedAtMs
      : typeof base.createdAt === "number" && base.createdAt > 0
        ? base.createdAt
        : Date.now();
  const thinkingDuration =
    typeof agentUi?.thinkingDurationSeconds === "number" &&
    agentUi.thinkingDurationSeconds > 0
      ? agentUi.thinkingDurationSeconds
      : typeof base.thinkingDurationSeconds === "number" &&
          base.thinkingDurationSeconds > 0
        ? base.thinkingDurationSeconds
        : hasThinking
          ? 1
          : undefined;
  const completedAtMs =
    typeof agentUi?.completedAtMs === "number" &&
    agentUi.completedAtMs >= stamp
      ? agentUi.completedAtMs
      : stamp +
        Math.max(1000, (thinkingDuration ?? 1) * 1000 + (hasTools ? 2000 : 0));

  const frames: AgentFrame[] | undefined = hasTools || hasThinking
    ? [
        {
          id: `hydrated-${base.id}`,
          complete: true,
          startedAtMs: stamp,
          completedAtMs,
          segments: [
            ...(hasThinking
              ? [
                  {
                    kind: "thinking" as const,
                    id: `thinking-${base.id}`,
                    content: thinking,
                    isStreaming: false,
                    durationSeconds: thinkingDuration,
                    startedAtMs: stamp,
                  },
                ]
              : []),
            ...tools,
          ],
        },
      ]
    : undefined;

  return enrichMessageAgentUi({
    ...base,
    content,
    thinkingContent: hasThinking ? thinking : base.thinkingContent,
    hasThinking: hasThinking || base.hasThinking,
    thinkingDurationSeconds:
      thinkingDuration ?? base.thinkingDurationSeconds,
    agentMode: hasTools || hasThinking || base.agentMode,
    agentFrameComplete: frames ? true : base.agentFrameComplete,
    agentFrames: frames ?? base.agentFrames,
    agentSegments: frames?.[0]?.segments ?? base.agentSegments,
  });
}

/**
 * Overlay branch-state edits onto the loaded page only.
 * Never replace the full thread with an unbounded branch blob.
 */
export function overlayBranchMessagesOnPage(input: {
  pageMessages: Message[];
  branchMessages: unknown;
}): Message[] {
  const page = input.pageMessages.map(enrichMessageAgentUi);
  if (!Array.isArray(input.branchMessages) || input.branchMessages.length === 0) {
    return page;
  }

  const byId = new Map<string, Message>();
  for (const raw of input.branchMessages) {
    if (!raw || typeof raw !== "object") continue;
    const message = raw as Message;
    if (typeof message.id !== "string" || !message.id) continue;
    if (message.role !== "user" && message.role !== "assistant") continue;
    byId.set(message.id, enrichMessageAgentUi(message));
  }

  if (byId.size === 0) return page;

  return page.map((message) => {
    const overlay = byId.get(message.id);
    if (!overlay) return message;
    // Branch state may arrive later than the durable assistant record. Keep
    // branch edits, but never let an older browser snapshot erase the
    // server-captured action frame or its completion timestamps.
    return {
      ...message,
      ...overlay,
      id: message.id,
      role: message.role,
      createdAt: overlay.createdAt ?? message.createdAt,
      agentMode: message.agentMode ?? overlay.agentMode,
      agentFrameComplete:
        message.agentFrameComplete ?? overlay.agentFrameComplete,
      agentFrames: message.agentFrames ?? overlay.agentFrames,
      agentSegments: message.agentSegments ?? overlay.agentSegments,
      activeAgentFrameIndex:
        message.activeAgentFrameIndex ?? overlay.activeAgentFrameIndex,
      agentArtifacts: message.agentArtifacts ?? overlay.agentArtifacts,
      thinkingContent: message.thinkingContent ?? overlay.thinkingContent,
      thinkingDurationSeconds:
        message.thinkingDurationSeconds ?? overlay.thinkingDurationSeconds,
    };
  });
}

/** @deprecated Prefer overlayBranchMessagesOnPage for keyset pages. */
export function resolveHydratedChatMessages(input: {
  apiMessages: Message[];
  branchMessages: unknown;
}): Message[] {
  return overlayBranchMessagesOnPage({
    pageMessages: input.apiMessages,
    branchMessages: input.branchMessages,
  });
}
