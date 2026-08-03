"use client";

/**
 * Device-side paint hint for the signed-in path.
 *
 * Edge-first architecture: Supabase SoR → chat-history Worker (Cache/KV/R2/HD)
 * → browser RAM. IndexedDB keeps sidebar list meta only — not full transcripts.
 */

import type { Message, RecentChat } from "@/lib/types";
import {
  deleteChatFromIndexedDB,
  loadChatMeta,
  persistChatMeta,
  type PersistedChatMeta,
  clearAllChatIndexedDB,
  listIndexedDBChatIds,
} from "@/lib/chat-storage";

/** Sidebar meta rows retained locally (titles only). */
export const DEVICE_CHAT_LIST_LIMIT = 100;

/** Sync mirror for first-paint sidebar (IndexedDB is async). */
const SYNC_CHAT_LIST_KEY = "clauxen-sync-chat-list";
/** Titles painted on first frame — keep tight for localStorage quota. */
const SYNC_CHAT_LIST_LIMIT = 50;

/** @deprecated Bodies are no longer persisted; kept for import compatibility. */
export const DEVICE_CHAT_MESSAGE_LIMIT = 0;

type SyncChatListPayload = {
  userId: string;
  savedAt: number;
  recentChats: RecentChat[];
};

function normalizeListRows(chats: RecentChat[]): RecentChat[] {
  return chats
    .filter((chat) => !chat.id.startsWith("pending-"))
    .slice(0, DEVICE_CHAT_LIST_LIMIT)
    .map((chat) => ({
      id: chat.id,
      name: chat.name,
      titleGenerated: chat.titleGenerated,
      projectId: chat.projectId,
      pinned: chat.pinned,
      updatedAt: chat.updatedAt,
      isCreating: false,
      isTitleStreaming: false,
    }));
}

/** Synchronous localStorage list for first paint (return visits). */
export function readSyncDeviceChatList(userId: string): RecentChat[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(SYNC_CHAT_LIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncChatListPayload;
    if (!parsed?.userId || parsed.userId !== userId) return null;
    if (!Array.isArray(parsed.recentChats) || parsed.recentChats.length === 0) {
      return null;
    }
    return parsed.recentChats
      .slice(0, SYNC_CHAT_LIST_LIMIT)
      .map((chat) => ({
        ...chat,
        isCreating: false,
        isTitleStreaming: false,
      }));
  } catch {
    return null;
  }
}

export function writeSyncDeviceChatList(
  userId: string,
  recentChats: RecentChat[],
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const payload: SyncChatListPayload = {
      userId,
      savedAt: Date.now(),
      recentChats: normalizeListRows(recentChats).slice(0, SYNC_CHAT_LIST_LIMIT),
    };
    localStorage.setItem(SYNC_CHAT_LIST_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearSyncDeviceChatList(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SYNC_CHAT_LIST_KEY);
  } catch {
    /* ignore */
  }
}

export function messagesForDeviceCache(messages: Message[]): Message[] {
  return messages;
}

export async function readDeviceChatList(
  userId: string,
): Promise<RecentChat[] | null> {
  const meta = await loadChatMeta();
  if (!meta) return null;
  if (meta.userId && meta.userId !== userId) {
    await clearAllChatIndexedDB();
    clearSyncDeviceChatList();
    return null;
  }
  if (!meta.recentChats?.length) return null;
  const rows = meta.recentChats
    .slice(0, DEVICE_CHAT_LIST_LIMIT)
    .map((chat) => ({
      ...chat,
      isCreating: false,
      isTitleStreaming: false,
    }));
  writeSyncDeviceChatList(userId, rows);
  return rows;
}

/** Bodies are not stored on device — always returns []. */
export async function readDeviceChatMessages(
  _chatId: string,
): Promise<Message[]> {
  return [];
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
      .slice(0, DEVICE_CHAT_LIST_LIMIT)
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

/** Persist sidebar meta only; prune any legacy message body slices. */
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

  const meta = buildDeviceChatMeta({
    userId: input.userId,
    recentChats: input.recentChats,
    activeChatId: input.activeChatId,
  });

  writeSyncDeviceChatList(input.userId, input.recentChats);

  timeoutId = setTimeout(() => {
    void (async () => {
      if (cancelled) return;
      try {
        await persistChatMeta(meta);
        // Drop legacy full-body slices from older clients.
        const ids = await listIndexedDBChatIds();
        for (const id of ids) {
          if (cancelled) return;
          await deleteChatFromIndexedDB(id);
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
  writeSyncDeviceChatList(userId, recentChats);
  await persistChatMeta(
    buildDeviceChatMeta({
      userId,
      recentChats,
      activeChatId,
    }),
  );
}

/** No-op body write — list meta only (edge-first hydrate). */
export async function persistDeviceChatNow(
  userId: string,
  _chatId: string,
  _messages: Message[],
  recentChats: RecentChat[],
  activeChatId: string | null,
): Promise<void> {
  await persistDeviceRecentChatsNow(userId, recentChats, activeChatId);
}

export async function forgetDeviceChat(chatId: string): Promise<void> {
  await deleteChatFromIndexedDB(chatId);
  const meta = await loadChatMeta();
  if (!meta) return;
  const recentChats = meta.recentChats.filter((c) => c.id !== chatId);
  if (meta.userId) {
    writeSyncDeviceChatList(meta.userId, recentChats);
  }
  await persistChatMeta({
    ...meta,
    recentChats,
    activeChatId:
      meta.activeChatId === chatId ? null : meta.activeChatId,
    savedAt: Date.now(),
  });
}
