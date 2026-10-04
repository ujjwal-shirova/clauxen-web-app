import type { MessageRow } from "@/server/repositories/messages.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";

/**
 * Load recent chat turns for model context directly from Postgres.
 * Always returns consistent, authoritative thread history for the active branch.
 */
export async function listRecentMessagesPreferCloudflare(input: {
  chatId: string;
  userId: string;
  limit?: number;
}): Promise<MessageRow[]> {
  const limit = Math.min(120, Math.max(1, input.limit ?? 40));

  try {
    // Active branch path only — inactive sibling rows must never enter the
    // model context.
    const page = await messagesRepo.listThreadPage({
      chatId: input.chatId,
      userId: input.userId,
      limit,
    });
    return page.messages;
  } catch {
    // Client transcript in the generate body still carries continuity.
    return [];
  }
}
