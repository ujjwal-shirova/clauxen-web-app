import type { Message } from "@/lib/types";
import {
  assistantClientIdForTurn,
  createTurnId,
  userClientIdForTurn,
} from "@/lib/chat-turn-id";

// Align with POST /api/v1/chats/[chatId]/messages — cap edit payloads client-side
const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024;

const streamless = (message: Message): Message => ({
  ...message,
  isStreaming: false,
  isThinkingStreaming: false,
});

/**
 * Remember an inactive variant's content so branch arrows paint instantly.
 * The server switch response remains the authority — this cache only removes
 * the round-trip flicker.
 */
function rememberSibling(
  message: Message,
  index: number,
  content: string,
): Array<{ id?: string; index: number; content: string }> {
  const siblings = (message.siblingVariants ?? []).filter(
    (variant) => variant.index !== index,
  );
  siblings.push({ id: message.id, index, content });
  return siblings;
}

function takeSibling(
  message: Message,
  index: number,
): string | undefined {
  return message.siblingVariants?.find(
    (variant) => variant.index === index,
  )?.content;
}

function variantCountOf(message: Message): number {
  return message.variantCount ?? 1;
}

function variantIndexOf(message: Message): number {
  const count = variantCountOf(message);
  const index = message.variantIndex ?? count - 1;
  return Math.max(0, Math.min(index, count - 1));
}

/** Drop legacy client-side branch fields (pre-tree metadata compatibility). */
export function stripLegacyBranchFields(message: Message): Message {
  const legacy = message as Message & {
    branchVersions?: unknown;
    activeBranchIndex?: unknown;
  };
  if (
    legacy.branchVersions === undefined &&
    legacy.activeBranchIndex === undefined
  ) {
    return message;
  }
  const clean = { ...message };
  delete (clean as { branchVersions?: unknown }).branchVersions;
  delete (clean as { activeBranchIndex?: unknown }).activeBranchIndex;
  return clean;
}

/**
 * Edit & resend a user prompt.
 *
 * The forked prompt is a NEW turn (fresh turn id → fresh user/assistant
 * client ids). The server inserts both rows as siblings of the original
 * prompt under the same tree parent; the original branch stays reachable via
 * the branch arrows.
 */
export function editMessageWithBranchHelper(
  existing: Message[],
  messageId: string,
  newContent: string,
  attachments?: Message["attachments"],
): {
  nextChat: Message[];
  forkedUserMessage: Message;
  assistantMessage: Message;
  turnId: string;
  userClientId: string;
  assistantClientId: string;
  targetIndex: number;
} {
  const targetIndex = existing.findIndex(
    (msg) => msg.id === messageId && msg.role === "user",
  );
  if (targetIndex === -1) {
    throw new Error("Target user message not found");
  }

  if (newContent.length > MAX_MESSAGE_CONTENT_CHARS) {
    throw new Error("Message content is too long");
  }

  const target = existing[targetIndex]!;
  const nextAttachments =
    attachments !== undefined ? attachments : target.attachments;
  const oldVariantIndex = variantIndexOf(target);
  const forkedIndex = variantCountOf(target);
  const turnId = createTurnId();
  const userClientId = userClientIdForTurn(turnId);
  const assistantClientId = assistantClientIdForTurn(turnId);
  const forkedUserMessageId = `temp-${userClientId}`;

  const existingSiblingIds =
    target.siblingIds && target.siblingIds.length > 0
      ? target.siblingIds
      : target.id
        ? [target.id]
        : [];

  const forkedUserMessage: Message = {
    id: forkedUserMessageId,
    clientId: userClientId,
    turnId,
    role: "user",
    content: newContent,
    attachments: nextAttachments,
    parentId: target.parentId,
    variantIndex: forkedIndex,
    variantCount: forkedIndex + 1,
    siblingIds: [...existingSiblingIds, forkedUserMessageId],
    siblingVariants: rememberSibling(target, oldVariantIndex, target.content),
    createdAt: Date.now(),
  };

  // Fork-time clock seeds the Working-for timer so it never snaps back when
  // the stream's start event arrives after network RTT.
  const forkedAtMs = Date.now();
  const assistantMessage: Message = {
    id: assistantClientId,
    clientId: assistantClientId,
    turnId,
    role: "assistant",
    content: "",
    thinkingContent: "",
    isStreaming: true,
    isThinkingStreaming: false,
    hasThinking: false,
    createdAt: forkedAtMs,
    agentMode: true,
    agentFrameComplete: false,
    agentTrace: { steps: [], startedAtMs: forkedAtMs },
  };

  // Forking hides the previous branch immediately: everything after the
  // edited prompt (its old answer + all follow-ups) is truncated in the same
  // synchronous update that paints the new streaming placeholder.
  const nextChat = [
    ...existing.slice(0, targetIndex).map(streamless),
    forkedUserMessage,
    assistantMessage,
  ];
  return {
    nextChat,
    forkedUserMessage,
    assistantMessage,
    turnId,
    userClientId,
    assistantClientId,
    targetIndex,
  };
}

/** Resend the same prompt — identical fork semantics to an edit. */
export function redoUserMessageWithBranchHelper(
  existing: Message[],
  messageId: string,
) {
  const targetMessage = existing.find(
    (msg) => msg.id === messageId && msg.role === "user",
  );
  if (!targetMessage) {
    throw new Error("Target user message not found");
  }
  return editMessageWithBranchHelper(
    existing,
    messageId,
    targetMessage.content,
  );
}

/**
 * Regenerate an assistant reply.
 *
 * The fresh reply is a NEW node (fresh client id for durable idempotency)
 * sharing the original's turn id and tree parent, so it siblings under the
 * same user prompt on the server.
 */
export function retryAssistantWithBranchHelper(
  existing: Message[],
  assistantMessageId: string,
): {
  nextChat: Message[];
  assistantMessage: Message;
  assistantClientId: string;
  assistantIndex: number;
} {
  const assistantIndex = existing.findIndex(
    (msg) => msg.id === assistantMessageId && msg.role === "assistant",
  );
  if (assistantIndex === -1) {
    throw new Error("Assistant message not found");
  }

  const target = existing[assistantIndex]!;
  const oldVariantIndex = variantIndexOf(target);
  const forkedIndex = variantCountOf(target);
  const assistantClientId = assistantClientIdForTurn(createTurnId());
  const forkedAtMs = Date.now();

  const existingSiblingIds =
    target.siblingIds && target.siblingIds.length > 0
      ? target.siblingIds
      : target.id
        ? [target.id]
        : [];

  const assistantMessage: Message = {
    ...target,
    id: assistantClientId,
    clientId: assistantClientId,
    turnId: target.turnId,
    content: "",
    thinkingContent: "",
    hasThinking: false,
    isStreaming: true,
    isThinkingStreaming: false,
    thinkingDurationSeconds: undefined,
    thinkingStartedAtMs: undefined,
    generationFailed: false,
    agentFrameComplete: false,
    agentTrace: { steps: [], startedAtMs: forkedAtMs },
    parentId: target.parentId,
    variantIndex: forkedIndex,
    variantCount: forkedIndex + 1,
    siblingIds: [...existingSiblingIds, assistantClientId],
    siblingVariants: rememberSibling(target, oldVariantIndex, target.content),
  };

  // Regenerating hides the previous answer immediately: the tail after the
  // retried response (follow-ups generated from the old content) is truncated
  // in the same synchronous update that paints the fresh streaming shell.
  const nextChat = [
    ...existing.slice(0, assistantIndex).map(streamless),
    assistantMessage,
  ];
  return { nextChat, assistantMessage, assistantClientId, assistantIndex };
}

/**
 * Optimistic branch-arrow paint. Swaps the visible content when the sibling's
 * text is cached locally; the authoritative thread always arrives from the
 * server switch response.
 */
export function switchMessageBranchHelper(
  chatMessages: Message[],
  messageId: string,
  direction: "prev" | "next",
): {
  nextChat: Message[];
  changed: boolean;
  variantIndex: number;
  variantCount: number;
  targetSiblingId?: string;
} {
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) {
    return {
      nextChat: chatMessages,
      changed: false,
      variantIndex: 0,
      variantCount: 1,
    };
  }

  const count = variantCountOf(targetMessage);
  const current = variantIndexOf(targetMessage);
  const next = direction === "prev" ? current - 1 : current + 1;

  if (count <= 1 || next < 0 || next >= count) {
    return {
      nextChat: chatMessages,
      changed: false,
      variantIndex: current,
      variantCount: count,
    };
  }

  const targetSiblingId =
    targetMessage.siblingIds?.[next] ??
    targetMessage.siblingVariants?.find((v) => v.index === next)?.id;

  const targetContent = takeSibling(targetMessage, next);
  if (targetContent === undefined) {
    // Sibling content not cached — let the server response paint it.
    return {
      nextChat: chatMessages,
      changed: false,
      variantIndex: next,
      variantCount: count,
      targetSiblingId,
    };
  }

  const nextChat = chatMessages.map((msg) =>
    msg.id === messageId
      ? {
          ...msg,
          id: targetSiblingId ?? msg.id,
          content: targetContent,
          variantIndex: next,
          siblingVariants: rememberSibling(msg, current, msg.content),
        }
      : msg,
  );
  return {
    nextChat,
    changed: true,
    variantIndex: next,
    variantCount: count,
    targetSiblingId,
  };
}