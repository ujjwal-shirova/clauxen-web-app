import type { Message } from "@/lib/types";
import type { AgentStep, AgentToolStep } from "@/lib/agent-trace";
import { enrichPersistedToolSegment } from "@/lib/enrich-agent-tool";
import { collectArtifactsFromAgentSteps } from "@/lib/chat-artifacts";
import type {
  TranscriptAgentModelTurn,
  TranscriptAgentUi,
  TranscriptContentPart,
  TranscriptMessageRecord,
} from "@/server/training/transcript-format";
import {
  parseAgentTextMarkup,
  parseThinkingMarkup,
} from "@/lib/agent-transcript-markup";

const CHAT_TITLE_BLOCK_RE = /<chat_title>[\s\S]*?<\/chat_title>/gi;
const CHAT_TITLE_TAG_RE = /<\/?chat_title>/gi;

function stripChatTitleMarkup(text: string): string {
  return text
    .replace(CHAT_TITLE_BLOCK_RE, "")
    .replace(CHAT_TITLE_TAG_RE, "")
    .trim();
}

function segmentsFromModelTurns(input: {
  messageId: string;
  turns: TranscriptAgentModelTurn[];
  agentUi?: TranscriptAgentUi;
  fallbackStamp: number;
}): AgentStep[] {
  const segments: AgentStep[] = [];
  let thinkingIndex = 0;
  let narrationIndex = 0;

  const persistedThinkingSeconds =
    typeof input.agentUi?.thinkingDurationSeconds === "number" &&
    input.agentUi.thinkingDurationSeconds > 0
      ? input.agentUi.thinkingDurationSeconds
      : undefined;
  const thinkingPartCount = input.turns.reduce(
    (count, turn) =>
      count + turn.assistant.filter((part) => part.type === "thinking").length,
    0,
  );

  for (const turn of input.turns) {
    const hasToolUse = turn.assistant.some((part) => part.type === "tool_use");
    const turnStartedAt =
      typeof turn.startedAtMs === "number"
        ? turn.startedAtMs
        : input.fallbackStamp;
    const assistantCompletedAt =
      typeof turn.assistantCompletedAtMs === "number"
        ? turn.assistantCompletedAtMs
        : turnStartedAt + 1000;
    const turnThinkingSeconds = Math.max(
      1,
      Math.round((assistantCompletedAt - turnStartedAt) / 1000),
    );

    for (const part of turn.assistant) {
      if (part.type === "thinking") {
        const parsed = parseThinkingMarkup(part.thinking);
        if (!parsed.body.trim()) continue;
        thinkingIndex += 1;
        // Prefer the accurately measured total when this turn only had one
        // thinking phase; otherwise fall back to per-turn assistant wall time
        // (excludes tool execution after the assistant message).
        const durationSeconds =
          thinkingPartCount === 1 && persistedThinkingSeconds
            ? persistedThinkingSeconds
            : turnThinkingSeconds;
        segments.push({
          kind: "thinking",
          id: `thinking-${input.messageId}-${thinkingIndex}`,
          content: parsed.body.trim(),
          isStreaming: false,
          durationSeconds,
          startedAtMs: turnStartedAt,
        });
        // Persisted CoT text stays in the message's thinkingContent only.
        continue;
      }

      if (part.type === "text") {
        const parsed = parseAgentTextMarkup(part.text);
        // No-tool rounds produced the durable answer → isFinal. Rounds with
        // tool_use produced progress prose → plain narration.
        const text = hasToolUse
          ? [parsed.narration.trim(), parsed.visibleText.trim()]
              .filter(Boolean)
              .join("\n\n")
          : parsed.visibleText.trim() || parsed.narration.trim();
        const cleaned = stripChatTitleMarkup(text);
        if (cleaned) {
          narrationIndex += 1;
          segments.push({
            kind: "narration",
            id: `narration-${input.messageId}-${narrationIndex}`,
            content: cleaned,
            isStreaming: false,
            ...(hasToolUse ? {} : { isFinal: true }),
          });
        }
        continue;
      }

      if (part.type !== "tool_use") continue;
      const action = input.agentUi?.actions?.find(
        (candidate) => candidate?.id === part.id,
      );
      const result = turn.toolResults?.find(
        (candidate) => candidate.tool_use_id === part.id,
      );
      segments.push(
        enrichPersistedToolSegment({
          kind: "tool",
          id: `tool-${part.id}`,
          toolCallId: part.id,
          name: part.name,
          status:
            action?.isError || result?.is_error === true ? "error" : "done",
          args: part.input ?? action?.input ?? {},
          result: action?.result ?? result?.content,
          description: action?.description,
          startedAtMs: action?.startedAtMs,
          completedAtMs: action?.completedAtMs,
        }),
      );
    }
  }

  return segments;
}

function enrichSegments(segments: AgentStep[]): AgentStep[] {
  return segments.map((segment) => {
    if (segment.kind !== "tool") return segment;
    return enrichPersistedToolSegment(segment);
  });
}

function enrichMessageAgentUi(message: Message): Message {
  const steps = message.agentTrace
    ? { ...message.agentTrace, steps: enrichSegments(message.agentTrace.steps) }
    : undefined;
  if (!steps) return message;
  return {
    ...message,
    agentTrace: steps,
  };
}

/**
 * Hydrate a UI Message from chat_messages.content_json when it is an
 * Canonical model transcript record
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
  const tools: AgentToolStep[] = [];
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
          candidate?.type === "tool_result" && candidate.tool_use_id === id,
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
              : (action?.input ?? {}),
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

  const contentFromParts = texts
    .map((text) => parseAgentTextMarkup(text).visibleText.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const stamp =
    typeof agentUi?.startedAtMs === "number" && agentUi.startedAtMs > 0
      ? agentUi.startedAtMs
      : typeof base.createdAt === "number" && base.createdAt > 0
        ? base.createdAt
        : Date.now();
  const modelTurns = Array.isArray(agentUi?.modelTurns)
    ? agentUi.modelTurns
    : [];
  const modelSegments =
    modelTurns.length > 0
      ? segmentsFromModelTurns({
          messageId: base.id,
          turns: modelTurns,
          agentUi,
          fallbackStamp: stamp,
        })
      : [];

  // Prefer durable row content; fall back to transcript text parts. Progress
  // narration (non-final) that also lingers in content gets blanked so the
  // same sentence isn't shown twice — but the promoted final segment IS the
  // answer, so it must never blank content.
  const narrationTexts = new Set(
    modelSegments
      .filter(
        (segment): segment is Extract<AgentStep, { kind: "narration" }> =>
          segment.kind === "narration" &&
          !segment.isFinal &&
          Boolean(segment.content.trim()),
      )
      .map((segment) => segment.content.trim()),
  );
  let content = (base.content ?? "").trim() || contentFromParts;
  if (content && narrationTexts.has(content)) {
    content = "";
  }
  const hasThinking = Boolean(thinking.trim());
  const hasTools =
    modelSegments.some((segment) => segment.kind === "tool") ||
    tools.length > 0;
  const hasAgentSegments = modelSegments.length > 0 || hasThinking || hasTools;

  if (!hasAgentSegments && !contentFromParts) return base;

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
    typeof agentUi?.completedAtMs === "number" && agentUi.completedAtMs >= stamp
      ? agentUi.completedAtMs
      : stamp +
        Math.max(1000, (thinkingDuration ?? 1) * 1000 + (hasTools ? 2000 : 0));

  const legacySegments: AgentStep[] = [
    ...(hasThinking
      ? [
          {
            kind: "thinking" as const,
            id: `thinking-${base.id}`,
            content: base.thinkingContent?.trim() || undefined,
            isStreaming: false,
            durationSeconds: thinkingDuration,
            startedAtMs: stamp,
          },
        ]
      : []),
    ...tools,
  ];
  const persistedSegments =
    modelSegments.length > 0 ? modelSegments : legacySegments;

  const trace =
    persistedSegments.length > 0
      ? {
          steps: persistedSegments,
          complete: true,
          startedAtMs: stamp,
          completedAtMs,
        }
      : undefined;

  return enrichMessageAgentUi({
    ...base,
    content,
    thinkingContent: hasThinking ? thinking : base.thinkingContent,
    hasThinking: hasThinking || base.hasThinking,
    thinkingDurationSeconds: thinkingDuration ?? base.thinkingDurationSeconds,
    agentMode: hasAgentSegments || base.agentMode,
    agentFrameComplete: trace ? true : base.agentFrameComplete,
    agentTrace: trace ?? base.agentTrace,
    agentArtifacts:
      base.agentArtifacts && base.agentArtifacts.length > 0
        ? base.agentArtifacts
        : collectArtifactsFromAgentSteps(base.id, persistedSegments),
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
  if (
    !Array.isArray(input.branchMessages) ||
    input.branchMessages.length === 0
  ) {
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
      agentTrace: message.agentTrace ?? overlay.agentTrace,
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
