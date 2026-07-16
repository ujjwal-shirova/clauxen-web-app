import type { Message } from "@/frontend/lib/types";

/**
 * Collapse duplicate chat rows that can appear from optimistic + realtime +
 * persist races (temp-* → server id, INSERT while streaming, etc.).
 *
 * Rules:
 * 1. Prefer durable (non-temp) ids over temp-* / pending-* when content matches.
 * 2. Drop consecutive same-role same-content duplicates.
 * 3. Keep first occurrence order.
 */
export function dedupeChatMessages(messages: readonly Message[]): Message[] {
  if (messages.length <= 1) return [...messages];

  const byId = new Map<string, Message>();
  const order: string[] = [];

  for (const message of messages) {
    if (!message?.id) continue;
    const existing = byId.get(message.id);
    if (existing) {
      byId.set(message.id, mergeMessagePreferRich(existing, message));
      continue;
    }
    byId.set(message.id, message);
    order.push(message.id);
  }

  let list = order.map((id) => byId.get(id)!);

  // Collapse temp user + durable user with identical content.
  list = collapseTempServerPairs(list);

  // Collapse consecutive identical user/assistant bubbles.
  list = collapseConsecutiveDuplicates(list);

  return list;
}

function isEphemeralId(id: string): boolean {
  return id.startsWith("temp-") || id.startsWith("pending-");
}

function mergeMessagePreferRich(a: Message, b: Message): Message {
  // Prefer the row with more content / agent UI / non-streaming finality.
  const aScore =
    (a.content?.length ?? 0) +
    (a.agentFrames?.length ?? 0) * 100 +
    (a.isStreaming ? 0 : 50);
  const bScore =
    (b.content?.length ?? 0) +
    (b.agentFrames?.length ?? 0) * 100 +
    (b.isStreaming ? 0 : 50);
  const prefer = bScore >= aScore ? b : a;
  const other = prefer === a ? b : a;
  return {
    ...other,
    ...prefer,
    id: isEphemeralId(prefer.id) && !isEphemeralId(other.id) ? other.id : prefer.id,
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    attachments: prefer.attachments ?? other.attachments,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
  };
}

function collapseTempServerPairs(messages: Message[]): Message[] {
  const result: Message[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < messages.length; i += 1) {
    if (consumed.has(i)) continue;
    const message = messages[i]!;

    if (message.role === "user" && isEphemeralId(message.id)) {
      const matchIndex = messages.findIndex(
        (candidate, index) =>
          index !== i &&
          !consumed.has(index) &&
          candidate.role === "user" &&
          !isEphemeralId(candidate.id) &&
          candidate.content.trim() === message.content.trim(),
      );
      if (matchIndex >= 0) {
        consumed.add(i);
        consumed.add(matchIndex);
        result.push(
          mergeMessagePreferRich(message, messages[matchIndex]!),
        );
        continue;
      }
    }

    result.push(message);
  }

  return result;
}

function collapseConsecutiveDuplicates(messages: Message[]): Message[] {
  const result: Message[] = [];
  for (const message of messages) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.role === message.role &&
      prev.content.trim() === message.content.trim() &&
      prev.role === "user"
    ) {
      // Keep the durable / richer row.
      result[result.length - 1] = mergeMessagePreferRich(prev, message);
      continue;
    }
    result.push(message);
  }
  return result;
}
