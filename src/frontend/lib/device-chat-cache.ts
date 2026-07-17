"use client";

/**
 * Device-side chat cache for the signed-in (API) path.
 *
 * Ladder: RAM (Zustand) → IndexedDB → CF history Worker / API → Supabase.
 * Realtime + background reconcile keep IDB warm without polling.
 * Server remains source of truth; this only cuts latency and origin load.
 */

import type { Message, RecentChat } from "@/frontend/lib/types";
import { compactMessageBranchData } from "@/frontend/lib/chat-branch";
import {
  deleteChatFromIndexedDB,
  loadChatMeta,
  loadFullChatFromIndexedDB,
  persistChatMeta,
  persistChatToIndexedDB,
  type PersistedChatMeta,
  clearAllChatIndexedDB,
  listIndexedDBChatIds,
} from "@/frontend/lib/chat-storage";

/** Keep message bodies for the N most recently updated chats. */
export const DEVICE_CHAT_MESSAGE_LIMIT = 40;

export function messagesForDeviceCache(messages: Message[]): Message[] {
  return messages.map((message) =>
    compactMessageBranchData({
      ...message,
      isStreaming: false,
      isThinkingStreaming: false,
    }),
  );
}

export async function readDeviceChatList(
  userId: string,
): Promise<RecentChat[] | null> {
  const meta = await loadChatMeta();
  if (!meta) return null;
  if (meta.userId && meta.userId !== userId) {
    await clearAllChatIndexedDB();
    return null;
  }
  if (!meta.recentChats?.length) return null;
  return meta.recentChats.map((chat) => ({
    ...chat,
    isCreating: false,
    isTitleStreaming: false,
  }));
}

export async function readDeviceChatMessages(
  chatId: string,
): Promise<Message[]> {
  const loaded = await loadFullChatFromIndexedDB(chatId);
  if (loaded.length === 0) return [];
  return messagesForDeviceCache(loaded);
}

export function buildDeviceChatMeta(input: {
  userId: string;
  recentChats: RecentChat[];
  activeChatId: string | null;
  branchDataset?: PersistedChatMeta["branchDataset"];
}): PersistedChatMeta {
  return {
    userId: input.userId,
    savedAt: Date.now(),
    recentChats: input.recentChats
      .filter((chat) => !chat.id.startsWith("pending-"))
      .map((chat) => ({
        id: chat.id,
        name: chat.name,
        titleGenerated: chat.titleGenerated,
        projectId: chat.projectId,
        pinned: chat.pinned,
        updatedAt: chat.updatedAt,
      })),
    activeChatId: input.activeChatId,
    branchDataset: input.branchDataset ?? {},
  };
}

export function scheduleDeviceChatPersist(input: {
  userId: string;
  allChats: Record<string, Message[]>;
  recentChats: RecentChat[];
  activeChatId: string | null;
  delayMs?: number;
}): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const delayMs = input.delayMs ?? 200;

  const compacted: Record<string, Message[]> = {};
  for (const [chatId, messages] of Object.entries(input.allChats)) {
    if (chatId.startsWith("pending-")) continue;
    if (!messages.length) continue;
    compacted[chatId] = messagesForDeviceCache(messages);
  }

  const meta = buildDeviceChatMeta({
    userId: input.userId,
    recentChats: input.recentChats,
    activeChatId: input.activeChatId,
  });

  const keep = new Set(
    [
      ...meta.recentChats
        .slice()
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, DEVICE_CHAT_MESSAGE_LIMIT)
        .map((c) => c.id),
      ...Object.keys(compacted),
      ...(input.activeChatId ? [input.activeChatId] : []),
    ].filter(Boolean),
  );

  timeoutId = setTimeout(() => {
    void (async () => {
      if (cancelled) return;
      try {
        await persistChatMeta(meta);
        for (const [chatId, messages] of Object.entries(compacted)) {
          if (cancelled) return;
          await persistChatToIndexedDB(chatId, messages);
        }
        const ids = await listIndexedDBChatIds();
        for (const id of ids) {
          if (cancelled) return;
          if (!keep.has(id)) await deleteChatFromIndexedDB(id);
        }
      } catch (error) {
        console.warn("[device-chat-cache] persist failed:", error);
      }
    })();
  }, delayMs);

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

export async function persistDeviceRecentChatsNow(
  userId: string,
  recentChats: RecentChat[],
  activeChatId: string | null,
): Promise<void> {
  await persistChatMeta(
    buildDeviceChatMeta({
      userId,
      recentChats,
      activeChatId,
    }),
  );
}

export async function persistDeviceChatNow(
  userId: string,
  chatId: string,
  messages: Message[],
  recentChats: RecentChat[],
  activeChatId: string | null,
): Promise<void> {
  if (chatId.startsWith("pending-")) return;
  await persistChatToIndexedDB(chatId, messagesForDeviceCache(messages));
  await persistChatMeta(
    buildDeviceChatMeta({
      userId,
      recentChats,
      activeChatId,
    }),
  );
}

export async function forgetDeviceChat(chatId: string): Promise<void> {
  await deleteChatFromIndexedDB(chatId);
  const meta = await loadChatMeta();
  if (!meta) return;
  await persistChatMeta({
    ...meta,
    recentChats: meta.recentChats.filter((c) => c.id !== chatId),
    activeChatId:
      meta.activeChatId === chatId ? null : meta.activeChatId,
    savedAt: Date.now(),
  });
}
