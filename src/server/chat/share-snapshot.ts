import type { MessageRow } from "@/server/repositories/messages.repository";
import type { SharedChatSnapshot } from "@/lib/share-public";
import { AppError } from "@/server/db/errors";

const MAX_MESSAGES = 400;
const MAX_MESSAGE_CHARS = 100_000;
const MAX_SNAPSHOT_CHARS = 6_000_000;

export function buildShareSnapshot(input: {
  title: string | null | undefined;
  messages: MessageRow[];
}): SharedChatSnapshot {
  const messages: SharedChatSnapshot["messages"] = [];
  let used = 0;

  for (const row of input.messages) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const content = (row.content ?? "").replace(/\u0000/g, "").trim();
    if (!content) continue;
    const clipped = content.slice(0, MAX_MESSAGE_CHARS);
    used += clipped.length;
    if (messages.length >= MAX_MESSAGES || used > MAX_SNAPSHOT_CHARS) {
      throw new AppError(
        "This chat is too large to share.",
        413,
        "share_too_large",
      );
    }
    messages.push({
      id: row.id,
      role: row.role,
      content: clipped,
      createdAt: row.created_at,
    });
  }

  const title = (input.title ?? "").replace(/\u0000/g, "").trim().slice(0, 200);
  return {
    title: title || "Shared chat",
    capturedAt: new Date().toISOString(),
    messages,
  };
}
