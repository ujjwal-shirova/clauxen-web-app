import { isValidChatId } from "@/lib/chat-id";
import { AppError } from "@/backend/db/errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept hex UUIDs, short Clauxen chat ids (8-4-4-4-12), and legacy long-form ids. */
export function isAcceptableChatId(chatId: string): boolean {
  return UUID_RE.test(chatId) || isValidChatId(chatId);
}

export function requireChatIdParam(chatId: string): string {
  if (!isAcceptableChatId(chatId)) {
    throw new AppError("Invalid chat id.", 400, "bad_request");
  }
  return chatId;
}
