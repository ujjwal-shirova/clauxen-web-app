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
  const groupByTurnId = new Map<string, ConversationTurnGroup>();

  for (const message of messages) {
    if (message.role === "user") {
      const group: ConversationTurnGroup = {
        userMessage: message,
        assistantMessages: [],
      };
      groups.push(group);
      if (message.turnId) groupByTurnId.set(message.turnId, group);
      continue;
    }
    if (message.role !== "assistant") continue;

    const matched = message.turnId
      ? groupByTurnId.get(message.turnId)
      : undefined;
    if (matched) {
      matched.assistantMessages.push(message);
      continue;
    }

    const open = groups[groups.length - 1];
    const openTurnId = open?.userMessage?.turnId;

    if (message.turnId && openTurnId && message.turnId !== openTurnId) {
      const orphan: ConversationTurnGroup = {
        userMessage: null,
        assistantMessages: [message],
      };
      groups.push(orphan);
      groupByTurnId.set(message.turnId, orphan);
      continue;
    }

    if (open) {
      open.assistantMessages.push(message);
      if (message.turnId) groupByTurnId.set(message.turnId, open);
    } else {
      const orphan: ConversationTurnGroup = {
        userMessage: null,
        assistantMessages: [message],
      };
      groups.push(orphan);
      if (message.turnId) groupByTurnId.set(message.turnId, orphan);
    }
  }

  return groups;
}
