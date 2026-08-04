import type { Message } from "@/lib/types";
import { deriveTurnIdFromClientId } from "@/lib/chat-turn-id";

/**
 * Transcript normalizer.
 *
 * The turn-native chat store already dedupes by id and groups by turn by
 * construction, so the transcript is stable without any post-hoc healing.
 * This module remains a thin safety net for callers that build a raw list
 * before handing it to the store: it assigns turn ids to legacy rows and
 * collapses rows that share an identity. It never re-pairs a finished
 * answer with another turn.
 */
export function dedupeChatMessages(messages: readonly Message[]): Message[] {
  if (messages.length <= 1) return [...messages];
  const tagged = ensureTurnIds(messages);
  return collapseSharedIdentities(tagged);
}

function isLive(message: Message): boolean {
  return message.isStreaming === true || message.isThinkingStreaming === true;
}

function hasBody(message: Message): boolean {
  if (message.content?.trim()) return true;
  if (message.agentSegments?.length) return true;
  if (message.agentFrames?.some((f) => f.segments.length > 0)) return true;
  if (message.agentArtifacts?.length) return true;
  return false;
}

export function hasAssistantBody(message: Message): boolean {
  return hasBody(message);
}

export function isBlankStreamingPlaceholder(message: Message): boolean {
  return message.role === "assistant" && isLive(message) && !hasBody(message);
}

function sameIdentity(a: Message, b: Message): boolean {
  if (a.id === b.id) return true;
  const ids = (m: Message) =>
    [m.id, m.clientId].filter(Boolean) as string[];
  return ids(a).some((id) => ids(b).includes(id));
}

function preferDurableId(a: Message, b: Message): string {
  if (a.id.startsWith("temp-") && !b.id.startsWith("temp-")) return b.id;
  if (b.id.startsWith("temp-") && !a.id.startsWith("temp-")) return a.id;
  return a.id;
}

function mergePair(a: Message, b: Message): Message {
  const aLive = isLive(a);
  const bLive = isLive(b);
  const aLen = a.content?.trim().length ?? 0;
  const bLen = b.content?.trim().length ?? 0;

  if (aLive && !bLive && aLen >= bLen) {
    return {
      ...b,
      ...a,
      id: preferDurableId(a, b),
      clientId: a.clientId ?? b.clientId ?? a.id,
      turnId: a.turnId ?? b.turnId,
      isStreaming: true,
    };
  }
  if (bLive && !aLive && bLen >= aLen) {
    return {
      ...a,
      ...b,
      id: preferDurableId(a, b),
      clientId: b.clientId ?? a.clientId ?? b.id,
      turnId: b.turnId ?? a.turnId,
      isStreaming: true,
    };
  }

  const prefer = aLen >= bLen ? a : b;
  const other = prefer === a ? b : a;
  return {
    ...other,
    ...prefer,
    id: preferDurableId(prefer, other),
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    turnId: prefer.turnId ?? other.turnId,
    content: aLen >= bLen ? a.content : b.content,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
  };
}

/** Ensure every row carries a turnId. Legacy rows derive one from clientId or position. */
export function ensureTurnIds(messages: readonly Message[]): Message[] {
  if (messages.every((m) => m.turnId)) return [...messages];

  const out: Message[] = [];
  let counter = 0;
  let current: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      counter += 1;
      current =
        message.turnId?.trim() ||
        deriveTurnIdFromClientId(message.clientId) ||
        `turn-${counter}`;
      out.push({ ...message, turnId: current });
      continue;
    }
    if (message.turnId?.trim()) {
      current = message.turnId.trim();
      out.push(message);
      continue;
    }
    const derived = deriveTurnIdFromClientId(message.clientId);
    if (derived) {
      current = derived;
      out.push({ ...message, turnId: derived });
      continue;
    }
    if (!current) {
      counter += 1;
      current = `turn-${counter}`;
    }
    out.push({ ...message, turnId: current });
  }
  return out;
}

/** Collapse rows that share an identity (id / clientId), preferring richer content. */
function collapseSharedIdentities(messages: readonly Message[]): Message[] {
  const result: Message[] = [];
  for (const message of messages) {
    const twinIndex = result.findIndex(
      (other) => other !== message && sameIdentity(other, message),
    );
    if (twinIndex >= 0) {
      result[twinIndex] = mergePair(result[twinIndex]!, message);
    } else {
      result.push(message);
    }
  }
  return result;
}

/** Seal finished assistants so a queue flush cannot treat them as live. */
export function sealCompletedAssistantMessages(
  messages: readonly Message[],
): Message[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    if (!isLive(message)) {
      return message.agentFrameComplete
        ? message
        : { ...message, agentFrameComplete: true };
    }
    if (hasBody(message) || message.agentFrameComplete) {
      return {
        ...message,
        isStreaming: false,
        isThinkingStreaming: false,
        agentFrameComplete: true,
      };
    }
    return message;
  });
}

export { ensureTurnIds as assignLegacyTurnIds };
