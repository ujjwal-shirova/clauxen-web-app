import type { Message } from "@/lib/types";

/**
 * Collapse duplicate chat rows that can appear from optimistic + realtime +
 * persist races (temp-* → server id, INSERT while streaming, etc.).
 *
 * Rules:
 * 1. Prefer durable (non-temp) ids over temp-* / pending-* when content matches.
 * 2. Never let an empty/cold server snapshot kill a live streaming orb.
 * 3. Drop consecutive same-role same-content duplicates.
 * 4. Keep first occurrence order.
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

function isLiveStreaming(message: Message): boolean {
  return (
    message.isStreaming === true || message.isThinkingStreaming === true
  );
}

function contentLen(message: Message): number {
  return message.content?.trim().length ?? 0;
}

function preferDurableId(a: Message, b: Message): string {
  if (isEphemeralId(a.id) && !isEphemeralId(b.id)) return b.id;
  if (isEphemeralId(b.id) && !isEphemeralId(a.id)) return a.id;
  return a.id;
}

/** Exported for unit tests — keep streaming orbs ahead of empty snapshots. */
export function mergeMessagePreferRich(a: Message, b: Message): Message {
  const aLive = isLiveStreaming(a);
  const bLive = isLiveStreaming(b);
  const aLen = contentLen(a);
  const bLen = contentLen(b);
  const aFrames = a.agentFrames?.length ?? 0;
  const bFrames = b.agentFrames?.length ?? 0;

  // Critical: an empty/cold completed row must never replace a live orb.
  if (aLive && !bLive && aLen >= bLen) {
    return {
      ...b,
      ...a,
      id: preferDurableId(a, b),
      clientId: a.clientId ?? b.clientId ?? a.id,
      attachments: a.attachments ?? b.attachments,
      isStreaming: true,
      isThinkingStreaming: a.isThinkingStreaming ?? false,
    };
  }
  if (bLive && !aLive && bLen >= aLen) {
    return {
      ...a,
      ...b,
      id: preferDurableId(a, b),
      clientId: b.clientId ?? a.clientId ?? b.id,
      attachments: b.attachments ?? a.attachments,
      isStreaming: true,
      isThinkingStreaming: b.isThinkingStreaming ?? false,
    };
  }

  const aScore =
    aLen + aFrames * 100 + (aLive ? 40 : 0) + (!aLive && aLen > 0 ? 20 : 0);
  const bScore =
    bLen + bFrames * 100 + (bLive ? 40 : 0) + (!bLive && bLen > 0 ? 20 : 0);
  const prefer = bScore > aScore ? b : aScore > bScore ? a : bLive ? b : a;
  const other = prefer === a ? b : a;

  return {
    ...other,
    ...prefer,
    id: preferDurableId(prefer, other),
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    attachments: prefer.attachments ?? other.attachments,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
    // If either side is still live and content isn't richer on the cold side,
    // keep the streaming flags so the orb does not vanish mid-turn.
    isStreaming:
      prefer.isStreaming ||
      (other.isStreaming === true && contentLen(prefer) <= contentLen(other)),
    isThinkingStreaming:
      prefer.isThinkingStreaming ||
      (other.isThinkingStreaming === true &&
        contentLen(prefer) <= contentLen(other)),
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

    // Collapse temp/live assistant with durable assistant for same client id
    // or identical empty/partial streaming turn.
    if (message.role === "assistant") {
      const matchIndex = messages.findIndex((candidate, index) => {
        if (index === i || consumed.has(index)) return false;
        if (candidate.role !== "assistant") return false;
        if (
          message.clientId &&
          (candidate.clientId === message.clientId ||
            candidate.id === message.clientId ||
            message.id === candidate.clientId)
        ) {
          return true;
        }
        // Both empty streaming placeholders for the same turn.
        return (
          isLiveStreaming(message) &&
          isLiveStreaming(candidate) &&
          contentLen(message) === 0 &&
          contentLen(candidate) === 0
        );
      });
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
      (prev.role === "user" ||
        (prev.role === "assistant" &&
          (isLiveStreaming(prev) ||
            isLiveStreaming(message) ||
            !prev.content.trim())))
    ) {
      result[result.length - 1] = mergeMessagePreferRich(prev, message);
      continue;
    }
    result.push(message);
  }
  return result;
}
