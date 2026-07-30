/**
 * Snapshot a chat (row + full transcript) to R2 before delete/archive,
 * and restore it on unarchive. Buckets stay user-scoped under the
 * chat-archives bucket with `deleted/` vs `archived/` prefixes.
 *
 * Flow:
 * - delete: R2 `deleted/` tombstone → soft-delete chat → purge messages
 * - archive: R2 `archived/` snapshot → soft-archive chat → purge messages
 * - unarchive: fetch `archived/` → restore messages into Supabase → reactivate
 */

import { AppError } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import {
  buildChatDeletedArchiveKey,
  buildChatUserArchiveKey,
  putObject,
  getObject,
  isR2Configured,
} from "@/server/storage/object-store";

export type ChatArchiveReason = "deleted" | "archived";

type ChatSnapshot = {
  version: 1;
  archivedAt: string;
  reason: ChatArchiveReason;
  chat: Record<string, unknown>;
  messages: Array<Record<string, unknown>>;
};

function keyForReason(
  reason: ChatArchiveReason,
  userId: string,
  chatId: string,
): string {
  return reason === "deleted"
    ? buildChatDeletedArchiveKey(userId, chatId)
    : buildChatUserArchiveKey(userId, chatId);
}

async function writeSnapshot(input: {
  chatId: string;
  userId: string;
  reason: ChatArchiveReason;
}): Promise<ChatSnapshot> {
  const chat = (await chatsRepo.getChatForUserIncludingDeleted(
    input.chatId,
    input.userId,
  )) as Record<string, unknown> | null;
  const messages = (await messagesRepo.listMessagesForChat(input.chatId)) as
    | Array<Record<string, unknown>>
    | [];

  const snapshot: ChatSnapshot = {
    version: 1,
    archivedAt: new Date().toISOString(),
    reason: input.reason,
    chat: chat ?? { id: input.chatId, user_id: input.userId },
    messages: messages ?? [],
  };

  if (!isR2Configured()) {
    throw new AppError(
      "Chat archive storage is not configured.",
      503,
      "archive_storage_unavailable",
    );
  }

  await putObject({
    purpose: "chat-archives",
    key: keyForReason(input.reason, input.userId, input.chatId),
    body: JSON.stringify(snapshot),
    contentType: "application/json",
    metadata: {
      userId: input.userId,
      chatId: input.chatId,
      reason: input.reason,
    },
  });

  return snapshot;
}

/**
 * Write the R2 tombstone/snapshot BEFORE status change.
 * Does not purge messages — callers purge after soft-delete/archive succeeds.
 */
export async function archiveChatSnapshot(input: {
  chatId: string;
  userId: string;
  reason: ChatArchiveReason;
}): Promise<{ snapshotted: boolean }> {
  if (input.reason === "archived") {
    if (!isR2Configured()) {
      console.warn(
        "[chat-archive] R2 not configured — soft-archive without snapshot",
      );
      return { snapshotted: false };
    }
    await writeSnapshot(input);
    return { snapshotted: true };
  }

  // Deleted: prefer durable tombstone, but never block the user delete.
  try {
    if (!isR2Configured()) {
      console.warn(
        "[chat-archive] R2 not configured — soft-delete without tombstone",
      );
      return { snapshotted: false };
    }
    await writeSnapshot(input);
    return { snapshotted: true };
  } catch (error) {
    console.warn("[chat-archive] deleted snapshot failed", error);
    return { snapshotted: false };
  }
}

/** Purge live messages after a successful snapshot + status change. */
export async function purgeChatMessagesAfterArchive(input: {
  chatId: string;
  snapshotted: boolean;
}): Promise<void> {
  if (!input.snapshotted) return;
  try {
    await messagesRepo.deleteMessagesForChat(input.chatId);
  } catch (error) {
    console.warn("[chat-archive] message purge failed", error);
  }
}

/** Restore an archived chat from its R2 snapshot, reinsert messages, reactivate. */
export async function restoreChatFromArchive(input: {
  chatId: string;
  userId: string;
}): Promise<boolean> {
  try {
    if (isR2Configured()) {
      const raw = await getObject(
        "chat-archives",
        buildChatUserArchiveKey(input.userId, input.chatId),
      );
      const snapshot = JSON.parse(raw.toString("utf8")) as ChatSnapshot;
      const chat = snapshot.chat as { id?: string; title?: string };
      if (!chat?.id || chat.id !== input.chatId) return false;

      await messagesRepo.replaceMessagesFromSnapshot({
        chatId: input.chatId,
        userId: input.userId,
        messages: snapshot.messages ?? [],
      });

      await chatsRepo.restoreChat(input.chatId, input.userId, {
        title: typeof chat.title === "string" ? chat.title : undefined,
      });
      return true;
    }
  } catch (error) {
    console.warn("[chat-archive] restore from R2 failed", error);
  }

  // Fallback: messages never purged (local/dev) — just reactivate the row.
  try {
    const restored = await chatsRepo.restoreChat(input.chatId, input.userId);
    return Boolean(restored);
  } catch {
    return false;
  }
}
