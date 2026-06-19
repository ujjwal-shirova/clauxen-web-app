import type { IncomingMessage } from "@/backend/inference/novita";
import { stripMessageContentForModelApi } from "@/lib/model-context";
import { orderMessagesForPromptCache } from "@/backend/inference/prompt-cache";

export const CHAT_CONTEXT_MAX_TURNS = 24;
export const CHAT_CONTEXT_MAX_CHARS = 48_000;

export function trimIncomingMessagesForApi(
  messages: IncomingMessage[],
  maxTurns = CHAT_CONTEXT_MAX_TURNS,
  maxChars = CHAT_CONTEXT_MAX_CHARS,
): IncomingMessage[] {
  const usable = messages
    .map((message) => ({
      ...message,
      content: stripMessageContentForModelApi(message.content),
    }))
    .filter(
      (message) =>
        message.content.trim().length > 0 &&
        (message.role === "user" ||
          message.role === "assistant" ||
          message.role === "system"),
    );
  if (usable.length === 0) return [];

  const systemMessages = usable.filter((message) => message.role === "system");
  const conversational = usable.filter((message) => message.role !== "system");
  let trimmed = conversational.slice(-maxTurns);

  let totalChars = trimmed.reduce((sum, turn) => sum + turn.content.length, 0);
  while (trimmed.length > 2 && totalChars > maxChars) {
    const removed = trimmed.shift();
    if (!removed) break;
    totalChars -= removed.content.length;
  }

  const ordered = orderMessagesForPromptCache(
    systemMessages.slice(-1),
    trimmed,
  );
  return ordered;
}
