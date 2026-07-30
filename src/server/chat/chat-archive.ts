/**
 * Snapshot a chat (row + full transcript) to R2 before soft-delete/archive,
 * and restore it on unarchive. Buckets stay user-scoped under the
 * chat-archives bucket with `deleted/` vs `archived/` prefixes.
 */

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
}): Promise<void> {
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
}

/** Best-effort R2 tombstone before soft-delete. Never blocks the delete. */
export async function archiveChatSnapshot(input: {
  chatId: string;
  userId: string;
  reason: ChatArchiveReason;
}): Promise<void> {
  try {
    await writeSnapshot(input);
  } catch (error) {
    console.warn("[chat-archive] snapshot failed", error);
  }
}

/** Restore a soft-archived chat from its R2 snapshot, then reactivate. */
export async function restoreChatFromArchive(input: {
  chatId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const raw = await getObject(
      "chat-archives",
      buildChatUserArchiveKey(input.userId, input.chatId),
    );
    const snapshot = JSON.parse(raw.toString("utf8")) as ChatSnapshot;
    const chat = snapshot.chat as { id?: string; title?: string };
    if (!chat?.id || chat.id !== input.chatId) return false;
    await chatsRepo.restoreChat(input.chatId, input.userId, {
      title: typeof chat.title === "string" ? chat.title : undefined,
    });
    return true;
  } catch (error) {
    if (isR2Configured()) {
      console.warn("[chat-archive] restore failed", error);
    }
    return false;
  }
}
