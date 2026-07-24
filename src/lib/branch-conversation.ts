import type { Message } from "@/lib/types";
import { resolveAgentFrames } from "@/lib/agent-frames";
import { stripMessageContentForModelApi } from "@/lib/model-context";

/** Stateless chat API turn — rebuilt from the active branch on each request. */
export type ChatConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

/** @deprecated Use ChatConversationTurn */
export type AnthropicConversationTurn = ChatConversationTurn;

/** Active branch index per forked message (depth order in the thread). */
export type BranchActivePath = number[];

/** Keep recent turns for API payloads — full history stays in the UI store. */
export const CHAT_CONTEXT_MAX_TURNS = 32;
export const CHAT_CONTEXT_MAX_CHARS = 72_000;

/**
 * Summarize agent tool activity so follow-up turns keep grounding.
 * Without this, the model only sees final answer text and drifts off-topic.
 */
function agentContextAppendix(message: Message): string {
  if (message.role !== "assistant") return "";
  const frames = resolveAgentFrames(message);
  const tools: string[] = [];
  for (const frame of frames) {
    for (const segment of frame.segments) {
      if (segment.kind !== "tool") continue;
      const query =
        segment.searchQuery ||
        (typeof segment.args?.query === "string"
          ? segment.args.query
          : undefined);
      const label = query
        ? `${segment.name}(${query})`
        : segment.description || segment.name;
      tools.push(label);
    }
  }
  if (tools.length === 0) return "";
  // Compact — enough for the model to stay on-topic for follow-ups.
  const unique = [...new Set(tools)].slice(0, 12);
  return `\n\n[Prior agent actions in this turn: ${unique.join("; ")}]`;
}

function toConversationTurns(messages: readonly Message[]): ChatConversationTurn[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        (message.content.trim().length > 0 ||
          (message.role === "assistant" &&
            resolveAgentFrames(message).some((frame) =>
              frame.segments.some((segment) => segment.kind === "tool"),
            ))),
    )
    .map((message) => {
      const body = stripMessageContentForModelApi(
        message.content.trim() ||
          (message.role === "assistant" ? "(tool turn)" : ""),
      );
      const appendix =
        message.role === "assistant" ? agentContextAppendix(message) : "";
      return {
        role: message.role as "user" | "assistant",
        content: `${body}${appendix}`.trim(),
      };
    })
    .filter((turn) => turn.content.length > 0);
}

/** Trim from the start while preserving the latest user/assistant context. */
export function trimConversationForApi(
  turns: readonly ChatConversationTurn[],
  maxTurns = CHAT_CONTEXT_MAX_TURNS,
  maxChars = CHAT_CONTEXT_MAX_CHARS,
): ChatConversationTurn[] {
  if (turns.length === 0) return [];

  let trimmed = turns.slice(-maxTurns);
  let totalChars = trimmed.reduce((sum, turn) => sum + turn.content.length, 0);

  while (trimmed.length > 2 && totalChars > maxChars) {
    const removed = trimmed.shift();
    if (!removed) break;
    totalChars -= removed.content.length;
  }

  // Always keep the latest user turn (the question being answered).
  const lastUserIndex = [...trimmed]
    .map((turn, index) => (turn.role === "user" ? index : -1))
    .filter((index) => index >= 0)
    .pop();
  if (lastUserIndex == null) return trimmed;

  // Ensure we didn't drop the latest user while trimming chars.
  const lastUser = trimmed[lastUserIndex];
  if (!lastUser) return trimmed;
  return trimmed;
}

export type BuildChatConversationOptions = {
  /** When true (default), apply turn/char limits for API cost control. */
  forApi?: boolean;
  maxTurns?: number;
  maxChars?: number;
};

export function buildChatConversation(
  messages: readonly Message[],
  options?: BuildChatConversationOptions,
): ChatConversationTurn[] {
  const turns = toConversationTurns(messages);
  if (options?.forApi === false) return turns;
  return trimConversationForApi(
    turns,
    options?.maxTurns ?? CHAT_CONTEXT_MAX_TURNS,
    options?.maxChars ?? CHAT_CONTEXT_MAX_CHARS,
  );
}

/** @deprecated Use buildChatConversation */
export const buildAnthropicConversation = buildChatConversation;

/** Collect active branch indices for messages that have more than one version. */
export function extractActiveBranchPath(
  messages: readonly Message[],
): BranchActivePath {
  const path: BranchActivePath = [];
  for (const message of messages) {
    const versionCount = message.branchVersions?.length ?? 0;
    if (versionCount <= 1) continue;
    path.push(message.activeBranchIndex ?? versionCount - 1);
  }
  return path;
}

/** Strip branch metadata before persisting to API branch-state endpoints. */
export function serializeBranchStatePayload(messages: readonly Message[]) {
  return {
    activePath: extractActiveBranchPath(messages),
    messages: buildChatConversation(messages, { forApi: false }),
  };
}
