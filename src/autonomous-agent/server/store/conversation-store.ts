import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "@/backend/inference/novita";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
  assertNoSystemInjection,
  buildUserInputItem,
} from "@/autonomous-agent/server/logic/decision-surface";
import type {
  ConversationRecord,
  ConversationStatus,
} from "@/autonomous-agent/types/conversation";

const conversations = new Map<string, ConversationRecord>();

export function createConversation(id?: string): ConversationRecord {
  const conversationId = id ?? randomUUID();
  const now = Date.now();
  const record: ConversationRecord = {
    id: conversationId,
    createdAt: now,
    updatedAt: now,
    status: "idle",
    lastResponseId: null,
    pendingItems: [],
    activeRunId: null,
    pendingClarification: null,
  };
  conversations.set(conversationId, record);
  return record;
}

export function getConversation(id: string): ConversationRecord | null {
  return conversations.get(id) ?? null;
}

export function getOrCreateConversation(id?: string): ConversationRecord {
  if (id) {
    const existing = getConversation(id);
    if (existing) return existing;
    return createConversation(id);
  }
  return createConversation();
}

export function updateConversation(
  id: string,
  patch: Partial<ConversationRecord>,
): ConversationRecord {
  const current = conversations.get(id);
  if (!current) {
    throw new Error(`Conversation not found: ${id}`);
  }
  const next = { ...current, ...patch, updatedAt: Date.now() };
  conversations.set(id, next);
  return next;
}

export function setConversationStatus(
  id: string,
  status: ConversationStatus,
): void {
  updateConversation(id, { status });
}

export function syncConversationFromChatMessages(
  conversationId: string,
  messages: IncomingMessage[],
): ConversationRecord {
  const conv = getOrCreateConversation(conversationId);
  const trimmed = messages.filter((m) => m.content.trim().length > 0);

  if (conv.lastResponseId) {
    const lastUser = [...trimmed].reverse().find((m) => m.role === "user");
    if (!lastUser) return conv;
    const userItem = buildUserInputItem(lastUser.content);
    assertNoSystemInjection([userItem]);
    return updateConversation(conversationId, {
      pendingItems: [userItem],
      status: "running",
      pendingClarification: null,
    });
  }

  const items: ResponseInputItem[] = trimmed
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      type: "message" as const,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  assertNoSystemInjection(items);
  return updateConversation(conversationId, {
    pendingItems: items,
    status: "running",
    pendingClarification: null,
  });
}

export function appendUserMessage(
  conversationId: string,
  content: string,
): ConversationRecord {
  const conv = getConversation(conversationId);
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`);

  const userItem = buildUserInputItem(content);
  assertNoSystemInjection([userItem]);

  return updateConversation(conversationId, {
    pendingItems: [...conv.pendingItems, userItem],
    pendingClarification: null,
    status: "running",
  });
}

export function saveLastResponseId(
  conversationId: string,
  responseId: string,
): void {
  updateConversation(conversationId, { lastResponseId: responseId });
}

export function getLastResponseId(conversationId: string): string | null {
  return getConversation(conversationId)?.lastResponseId ?? null;
}

export function getPendingItems(conversationId: string): ResponseInputItem[] {
  return getConversation(conversationId)?.pendingItems ?? [];
}

export function clearPendingItems(conversationId: string): void {
  updateConversation(conversationId, { pendingItems: [] });
}

export function appendFunctionCallOutputs(
  conversationId: string,
  outputs: ResponseInputItem[],
): void {
  const conv = getConversation(conversationId);
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
  updateConversation(conversationId, {
    pendingItems: [...conv.pendingItems, ...outputs],
  });
}

export function setActiveRun(
  conversationId: string,
  runId: string | null,
): void {
  updateConversation(conversationId, { activeRunId: runId });
}

export function setPendingClarification(
  conversationId: string,
  clarification: { toolCallId: string; question: string } | null,
): void {
  updateConversation(conversationId, {
    pendingClarification: clarification,
    status: clarification ? "waiting_for_user" : "idle",
  });
}

export function listConversations(): ConversationRecord[] {
  return Array.from(conversations.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}
