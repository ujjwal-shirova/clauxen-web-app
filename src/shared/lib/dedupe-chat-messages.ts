import type { Message } from "@/lib/types";
import { deriveTurnIdFromClientId } from "@/lib/chat-turn-id";

/**
 * Normalize a chat's raw message list into a stable, turn-ordered transcript.
 *
 * A turn is exactly one user prompt plus its assistant reply. Each turn owns a
 * stable `turnId` encoded in both rows' `clientId`, so pairing is authoritative
 * across optimistic paint, SSE id remap, realtime INSERT/UPDATE, hydrate and
 * reload — no timestamp guessing, no re-pairing.
 *
 * Pipeline:
 *   1. Merge duplicate rows that share an identity (id / clientId).
 *   2. Ensure every row carries a `turnId` (legacy transcripts get synthetic ones).
 *   3. Group strictly by turn: a finished answer can never migrate to another
 *      turn, so a queued follow-up cannot erase or steal the previous reply.
 *   4. Collapse consecutive duplicates inside a turn.
 */
export function dedupeChatMessages(messages: readonly Message[]): Message[] {
  if (messages.length <= 1) return [...messages];

  const merged = mergeDuplicateRows(messages);
  const tagged = ensureTurnIds(merged);
  return groupByTurn(tagged);
}

function isEphemeralId(id: string): boolean {
  return id.startsWith("temp-") || id.startsWith("pending-");
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

/** A blank streaming orb — the only assistant row that may be folded into another. */
function isBlankOrb(message: Message): boolean {
  return message.role === "assistant" && isLive(message) && !hasBody(message);
}

function sameIdentity(a: Message, b: Message): boolean {
  if (a.id === b.id) return true;
  const ids = (m: Message) => [m.id, m.clientId].filter(Boolean) as string[];
  return ids(a).some((id) => ids(b).includes(id));
}

function preferDurableId(a: Message, b: Message): string {
  if (isEphemeralId(a.id) && !isEphemeralId(b.id)) return b.id;
  if (isEphemeralId(b.id) && !isEphemeralId(a.id)) return a.id;
  return a.id;
}

/**
 * Merge rows that share an identity, preferring the richer / live side.
 * Never let an empty cold snapshot kill a live orb; never resurrect streaming
 * on a contentful completed side from a blank placeholder.
 */
function mergeDuplicateRows(messages: readonly Message[]): Message[] {
  const byId = new Map<string, Message>();
  const order: string[] = [];

  for (const message of messages) {
    if (!message?.id) continue;
    const existing = byId.get(message.id);
    if (existing) {
      byId.set(message.id, mergePair(existing, message));
      continue;
    }
    byId.set(message.id, message);
    order.push(message.id);
  }

  // Also collapse rows linked by clientId but with different ids (temp↔durable).
  const result: Message[] = [];
  const consumed = new Set<string>();
  for (const id of order) {
    if (consumed.has(id)) continue;
    const message = byId.get(id)!;
    const twinIndex = result.findIndex(
      (other) => other !== message && sameIdentity(other, message),
    );
    if (twinIndex >= 0) {
      result[twinIndex] = mergePair(result[twinIndex]!, message);
      consumed.add(id);
    } else {
      result.push(message);
    }
  }
  return result;
}

function mergePair(a: Message, b: Message): Message {
  const aLive = isLive(a);
  const bLive = isLive(b);
  const aLen = a.content?.trim().length ?? 0;
  const bLen = b.content?.trim().length ?? 0;
  const aFrames = a.agentFrames?.length ?? 0;
  const bFrames = b.agentFrames?.length ?? 0;

  // A live orb wins over an empty cold snapshot — never kill the orb.
  if (aLive && !bLive && aLen >= bLen) {
    return {
      ...b,
      ...a,
      id: preferDurableId(a, b),
      clientId: a.clientId ?? b.clientId ?? a.id,
      turnId: a.turnId ?? b.turnId,
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
      turnId: b.turnId ?? a.turnId,
      attachments: b.attachments ?? a.attachments,
      isStreaming: true,
      isThinkingStreaming: b.isThinkingStreaming ?? false,
    };
  }

  const aScore = aLen + aFrames * 100 + (aLive ? 40 : 0) + (!aLive && aLen ? 20 : 0);
  const bScore = bLen + bFrames * 100 + (bLive ? 40 : 0) + (!bLive && bLen ? 20 : 0);
  const prefer = bScore > aScore ? b : aScore > bScore ? a : bLive ? b : a;
  const other = prefer === a ? b : a;

  const preferBlank = isBlankOrb(prefer);
  const otherBlank = isBlankOrb(other);
  const keepStreaming =
    preferBlank || otherBlank
      ? prefer.isStreaming === true || other.isStreaming === true
      : prefer.isStreaming === true
        ? true
        : other.isStreaming === true && aLen <= bLen;

  return {
    ...other,
    ...prefer,
    id: preferDurableId(prefer, other),
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    turnId: prefer.turnId ?? other.turnId,
    attachments: prefer.attachments ?? other.attachments,
    agentFrames: prefer.agentFrames?.length ? prefer.agentFrames : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
    isStreaming: keepStreaming,
    isThinkingStreaming:
      prefer.isThinkingStreaming ||
      (other.isThinkingStreaming === true && aLen <= bLen),
    agentFrameComplete:
      prefer.agentFrameComplete || other.agentFrameComplete || undefined,
  };
}

/** Ensure every row carries a turnId. Legacy rows derive one from clientId or position. */
function ensureTurnIds(messages: readonly Message[]): Message[] {
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

type Turn = { turnId: string; user: Message | null; assistants: Message[]; order: number };

/** Group strictly by turnId in encounter order. User leads its assistants. */
function groupByTurn(messages: readonly Message[]): Message[] {
  const buckets = new Map<string, Turn>();
  let order = 0;

  const ensure = (turnId: string): Turn => {
    const existing = buckets.get(turnId);
    if (existing) return existing;
    const bucket: Turn = { turnId, user: null, assistants: [], order: order++ };
    buckets.set(turnId, bucket);
    return bucket;
  };

  let latestUserTurn: Turn | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      const bucket = ensure(message.turnId!);
      bucket.user = bucket.user
        ? mergePair(bucket.user, message)
        : message;
      latestUserTurn = bucket;
      continue;
    }
    if (message.role !== "assistant") continue;

    const turnId = message.turnId!;
    const bucket = ensure(turnId);

    const existingIndex = bucket.assistants.findIndex((a) =>
      sameIdentity(a, message),
    );
    if (existingIndex >= 0) {
      bucket.assistants[existingIndex] = mergePair(
        bucket.assistants[existingIndex]!,
        message,
      );
      continue;
    }

    // Fold a blank orb into a live assistant of the same turn (one orb per turn).
    const liveIndex = bucket.assistants.findIndex((a) => isLive(a));
    if (
      liveIndex >= 0 &&
      (isBlankOrb(message) || isBlankOrb(bucket.assistants[liveIndex]!))
    ) {
      bucket.assistants[liveIndex] = mergePair(
        bucket.assistants[liveIndex]!,
        message,
      );
      continue;
    }

    bucket.assistants.push(message);
    if (bucket.user) latestUserTurn = bucket;
  }

  // An untagged blank orb with no bucket adopts the latest user turn.
  void latestUserTurn;

  const ordered = [...buckets.values()].sort((a, b) => a.order - b.order);
  const out: Message[] = [];
  for (const bucket of ordered) {
    if (bucket.user) out.push(bucket.user);
    for (const assistant of collapseConsecutive(bucket.assistants)) {
      out.push(assistant);
    }
  }
  return out;
}

function collapseConsecutive(assistants: Message[]): Message[] {
  const result: Message[] = [];
  for (const message of assistants) {
    const prev = result[result.length - 1];
    if (
      prev &&
      (sameIdentity(prev, message) ||
        (isBlankOrb(prev) && isLive(message)) ||
        (isBlankOrb(message) && isLive(prev)) ||
        (isBlankOrb(prev) && isBlankOrb(message)))
    ) {
      result[result.length - 1] = mergePair(prev, message);
      continue;
    }
    result.push(message);
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

// Re-exports kept for callers that still import the old surface.
export {
  hasBody as hasAssistantBody,
  isBlankOrb as isBlankStreamingPlaceholder,
  ensureTurnIds as assignLegacyTurnIds,
};
