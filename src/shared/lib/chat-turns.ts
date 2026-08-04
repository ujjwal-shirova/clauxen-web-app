import type { Message } from "@/lib/types";
import { dedupeChatMessages } from "@/lib/dedupe-chat-messages";

export type ConversationTurnGroup = {
  userMessage: Message | null;
  assistantMessages: Message[];
};

/**
 * Build render turns from a raw message list.
 *
 * `dedupeChatMessages` already emits a turn-ordered list (each user followed by
 * that turn's assistants), so grouping is a plain fold. An assistant joins
 * the open turn only when the turn ids agree — that is what stops a queued
 * follow-up from adopting the previous turn's answer.
 */
export function groupMessagesIntoTurns(
  messages: readonly Message[],
): ConversationTurnGroup[] {
  const groups: ConversationTurnGroup[] = [];
  const deduped = dedupeChatMessages(messages);

  for (const message of deduped) {
    if (message.role === "user") {
      groups.push({ userMessage: message, assistantMessages: [] });
      continue;
    }
    if (message.role !== "assistant") continue;

    const open = groups[groups.length - 1];
    const openTurnId = open?.userMessage?.turnId;

    if (message.turnId && openTurnId && message.turnId !== openTurnId) {
      groups.push({ userMessage: null, assistantMessages: [message] });
      continue;
    }

    if (open) {
      open.assistantMessages.push(message);
    } else {
      groups.push({ userMessage: null, assistantMessages: [message] });
    }
  }

  return groups;
}
