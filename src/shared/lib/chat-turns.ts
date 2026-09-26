import type { Message } from "@/lib/types";

export type ConversationTurnGroup = {
  userMessage: Message | null;
  assistantMessages: Message[];
};

/**
 * Build render turns from a message list.
 *
 * The turn-native chat store already dedupes by id and groups by turn by
 * construction, so the input is turn-ordered: each user is followed by that
 * turn's assistants. Grouping is a plain fold — an assistant joins the open
 * turn only when the turn ids agree, which is what stops a queued follow-up
 * from adopting the previous turn's answer.
 */
export function groupMessagesIntoTurns(
  messages: readonly Message[],
): ConversationTurnGroup[] {
  const groups: ConversationTurnGroup[] = [];

  for (const message of messages) {
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
      const duplicate = open.assistantMessages.some(
        (existing) =>
          existing.content.trim().length > 0 &&
          existing.content.trim() === message.content.trim(),
      );
      if (!duplicate) open.assistantMessages.push(message);
    } else {
      groups.push({ userMessage: null, assistantMessages: [message] });
    }
  }

  return groups;
}
