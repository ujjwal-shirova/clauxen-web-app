import type { Message } from "@/frontend/lib/types";

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
export const CHAT_CONTEXT_MAX_TURNS = 24;
export const CHAT_CONTEXT_MAX_CHARS = 48_000;

function toConversationTurns(messages: readonly Message[]): ChatConversationTurn[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content.trim(),
    }));
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
