import type { Message } from "@/lib/types";

/**
 * Transcript normalizer for optimistic + realtime + queue-flush races.
 *
 * Design:
 * 1. Collapse duplicate identities (id / clientId / temp↔durable).
 * 2. Prefer turnId-stable ordering so a finished answer can never jump under
 *    the next queued user prompt.
 * 3. Only blank live placeholders may be reattached; contentful assistants
 *    stay with their turn forever.
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
  list = collapseTempServerPairs(list);
  list = collapseDuplicateUserMessages(list);

  const hasTurnIds = list.some((message) => Boolean(message.turnId));
  if (hasTurnIds) {
    list = flattenByTurnId(list);
  } else {
    list = healChatMessageOrder(list);
    list = ensureBlankLivePlaceholdersFollowLatestUser(list);
  }

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

function hasAgentProgress(message: Message): boolean {
  if ((message.agentSegments?.length ?? 0) > 0) return true;
  if (message.agentFrames?.some((frame) => frame.segments.length > 0)) {
    return true;
  }
  if ((message.agentArtifacts?.length ?? 0) > 0) return true;
  return false;
}

export function hasAssistantBody(message: Message): boolean {
  return contentLen(message) > 0 || hasAgentProgress(message);
}

export function isBlankStreamingPlaceholder(message: Message): boolean {
  return (
    message.role === "assistant" &&
    isLiveStreaming(message) &&
    !hasAssistantBody(message)
  );
}

function sameAssistantIdentity(a: Message, b: Message): boolean {
  if (a.role !== "assistant" || b.role !== "assistant") return false;
  if (a.id === b.id) return true;
  if (
    a.clientId &&
    (a.clientId === b.clientId || a.clientId === b.id || b.clientId === a.id)
  ) {
    return true;
  }
  if (
    b.clientId &&
    (b.clientId === a.clientId || b.clientId === a.id || a.clientId === b.id)
  ) {
    return true;
  }
  return false;
}

function preferDurableId(a: Message, b: Message): string {
  if (isEphemeralId(a.id) && !isEphemeralId(b.id)) return b.id;
  if (isEphemeralId(b.id) && !isEphemeralId(a.id)) return a.id;
  return a.id;
}

export function mergeMessagePreferRich(a: Message, b: Message): Message {
  const aLive = isLiveStreaming(a);
  const bLive = isLiveStreaming(b);
  const aLen = contentLen(a);
  const bLen = contentLen(b);
  const aFrames = a.agentFrames?.length ?? 0;
  const bFrames = b.agentFrames?.length ?? 0;

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

  const aScore =
    aLen + aFrames * 100 + (aLive ? 40 : 0) + (!aLive && aLen > 0 ? 20 : 0);
  const bScore =
    bLen + bFrames * 100 + (bLive ? 40 : 0) + (!bLive && bLen > 0 ? 20 : 0);
  const prefer = bScore > aScore ? b : aScore > bScore ? a : bLive ? b : a;
  const other = prefer === a ? b : a;

  const preferIsBlank = isBlankStreamingPlaceholder(prefer);
  const otherIsBlank = isBlankStreamingPlaceholder(other);
  const keepStreaming =
    preferIsBlank || otherIsBlank
      ? prefer.isStreaming === true || other.isStreaming === true
      : prefer.isStreaming === true
        ? true
        : other.isStreaming === true && contentLen(prefer) <= contentLen(other);

  return {
    ...other,
    ...prefer,
    id: preferDurableId(prefer, other),
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    turnId: prefer.turnId ?? other.turnId,
    attachments: prefer.attachments ?? other.attachments,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
    isStreaming: keepStreaming,
    isThinkingStreaming:
      prefer.isThinkingStreaming ||
      (other.isThinkingStreaming === true &&
        contentLen(prefer) <= contentLen(other)),
    agentFrameComplete:
      prefer.agentFrameComplete || other.agentFrameComplete || undefined,
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
          (message.turnId && candidate.turnId
            ? message.turnId === candidate.turnId
            : candidate.content.trim() === message.content.trim()),
      );
      if (matchIndex >= 0) {
        consumed.add(i);
        consumed.add(matchIndex);
        result.push(mergeMessagePreferRich(message, messages[matchIndex]!));
        continue;
      }
    }

    if (message.role === "assistant") {
      const matchIndex = messages.findIndex((candidate, index) => {
        if (index === i || consumed.has(index)) return false;
        if (candidate.role !== "assistant") return false;
        if (sameAssistantIdentity(message, candidate)) return true;
        if (
          message.turnId &&
          candidate.turnId &&
          message.turnId === candidate.turnId &&
          (isBlankStreamingPlaceholder(message) ||
            isBlankStreamingPlaceholder(candidate))
        ) {
          return true;
        }
        return (
          isBlankStreamingPlaceholder(message) &&
          isBlankStreamingPlaceholder(candidate) &&
          (!message.turnId ||
            !candidate.turnId ||
            message.turnId === candidate.turnId)
        );
      });
      if (matchIndex >= 0) {
        consumed.add(i);
        consumed.add(matchIndex);
        result.push(mergeMessagePreferRich(message, messages[matchIndex]!));
        continue;
      }
    }

    result.push(message);
  }

  return result;
}

const SAME_USER_MESSAGE_WINDOW_MS = 2 * 60 * 1000;

function normalizeUserContent(content: string | undefined): string {
  return (content ?? "").replace(/\s+/g, " ").trim();
}

function isSameLogicalUserMessage(a: Message, b: Message): boolean {
  if (a.role !== "user" || b.role !== "user") return false;
  if (a.turnId && b.turnId) return a.turnId === b.turnId;
  if (normalizeUserContent(a.content) !== normalizeUserContent(b.content)) {
    return false;
  }
  if (isEphemeralId(a.id) || isEphemeralId(b.id)) return true;
  if (
    a.clientId &&
    (a.clientId === b.id || a.clientId === b.clientId || b.id === a.id)
  ) {
    return true;
  }
  if (
    b.clientId &&
    (b.clientId === a.id || b.clientId === a.clientId || a.id === b.id)
  ) {
    return true;
  }
  const aTime = a.createdAt;
  const bTime = b.createdAt;
  if (typeof aTime === "number" && typeof bTime === "number") {
    return Math.abs(aTime - bTime) <= SAME_USER_MESSAGE_WINDOW_MS;
  }
  return false;
}

function collapseDuplicateUserMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < messages.length; i += 1) {
    if (consumed.has(i)) continue;
    const message = messages[i]!;

    if (message.role === "user") {
      const matchIndex = messages.findIndex(
        (candidate, index) =>
          index > i &&
          !consumed.has(index) &&
          candidate.role === "user" &&
          candidate.id !== message.id &&
          isSameLogicalUserMessage(message, candidate),
      );
      if (matchIndex >= 0) {
        consumed.add(matchIndex);
        result.push(mergeMessagePreferRich(message, messages[matchIndex]!));
        continue;
      }
    }

    result.push(message);
  }

  return result;
}

type TurnBucket = {
  turnId: string;
  user: Message | null;
  assistants: Message[];
  order: number;
};

/**
 * Flatten by turnId encounter order. User always leads its assistants.
 * Blank live placeholders without a turn attach to the latest open user turn.
 */
export function flattenByTurnId(messages: readonly Message[]): Message[] {
  const buckets = new Map<string, TurnBucket>();
  const ordered: TurnBucket[] = [];
  let orderCounter = 0;

  const ensureBucket = (turnId: string): TurnBucket => {
    const existing = buckets.get(turnId);
    if (existing) return existing;
    const bucket: TurnBucket = {
      turnId,
      user: null,
      assistants: [],
      order: orderCounter++,
    };
    buckets.set(turnId, bucket);
    ordered.push(bucket);
    return bucket;
  };

  let latestUserTurnId: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      const turnId = message.turnId?.trim() || `legacy-user-${message.id}`;
      const bucket = ensureBucket(turnId);
      bucket.user = bucket.user
        ? mergeMessagePreferRich(bucket.user, { ...message, turnId })
        : { ...message, turnId };
      latestUserTurnId = turnId;
      continue;
    }

    if (message.role !== "assistant") continue;

    let turnId = message.turnId?.trim() || "";
    if (!turnId) {
      if (isBlankStreamingPlaceholder(message) && latestUserTurnId) {
        turnId = latestUserTurnId;
      } else {
        turnId = `legacy-assistant-${message.id}`;
      }
    }

    const bucket = ensureBucket(turnId);
    const existingIndex = bucket.assistants.findIndex((assistant) =>
      sameAssistantIdentity(assistant, message),
    );
    const stamped = { ...message, turnId };
    if (existingIndex >= 0) {
      bucket.assistants[existingIndex] = mergeMessagePreferRich(
        bucket.assistants[existingIndex]!,
        stamped,
      );
    } else if (
      isBlankStreamingPlaceholder(stamped) &&
      bucket.assistants.some((assistant) => isLiveStreaming(assistant))
    ) {
      const liveIndex = bucket.assistants.findIndex((assistant) =>
        isLiveStreaming(assistant),
      );
      bucket.assistants[liveIndex] = mergeMessagePreferRich(
        bucket.assistants[liveIndex]!,
        stamped,
      );
    } else {
      bucket.assistants.push(stamped);
    }
    if (bucket.user) latestUserTurnId = turnId;
  }

  ordered.sort((a, b) => a.order - b.order);

  const out: Message[] = [];
  for (const bucket of ordered) {
    if (bucket.user) out.push(bucket.user);
    for (const assistant of bucket.assistants) out.push(assistant);
  }
  return out;
}

export function healChatMessageOrder(
  messages: readonly Message[],
): Message[] {
  if (messages.length <= 1) return [...messages];
  const sorted = messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const aTime = a.message.createdAt;
      const bTime = b.message.createdAt;
      const aDated = typeof aTime === "number";
      const bDated = typeof bTime === "number";
      if (aDated && bDated && aTime !== bTime) {
        return (aTime as number) - (bTime as number);
      }
      if (aDated !== bDated) return aDated ? -1 : 1;
      if (aDated && bDated && a.message.role !== b.message.role) {
        return a.message.role === "user" ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ message }) => message);

  return healInvertedUserAssistantPairs(sorted);
}

export function ensureBlankLivePlaceholdersFollowLatestUser(
  messages: readonly Message[],
): Message[] {
  if (messages.length <= 1) return [...messages];

  let latestUserIndex = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.role === "user") latestUserIndex = i;
  }
  if (latestUserIndex < 0) return [...messages];

  const moveIndexes: number[] = [];
  for (let i = 0; i < latestUserIndex; i += 1) {
    const message = messages[i]!;
    if (isBlankStreamingPlaceholder(message)) moveIndexes.push(i);
  }
  if (moveIndexes.length === 0) return [...messages];

  const moveSet = new Set(moveIndexes);
  const moved = moveIndexes.map((index) => messages[index]!);
  const rest = messages.filter((_, index) => !moveSet.has(index));

  let insertAt = 0;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i]?.role === "user") insertAt = i + 1;
  }
  while (
    insertAt < rest.length &&
    rest[insertAt]?.role === "assistant" &&
    !isBlankStreamingPlaceholder(rest[insertAt]!)
  ) {
    insertAt += 1;
  }
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

export const ensureLiveAssistantsFollowLatestUser =
  ensureBlankLivePlaceholdersFollowLatestUser;

export function healInvertedUserAssistantPairs(
  messages: readonly Message[],
): Message[] {
  if (messages.length <= 1) return [...messages];
  const out = [...messages];

  for (let i = 0; i < out.length - 1; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1]!;
    if (cur.role !== "assistant" || next.role !== "user") continue;

    const prev = i > 0 ? out[i - 1]! : null;

    if (prev?.role === "user") {
      if (!isBlankStreamingPlaceholder(cur)) continue;
      // Different turn ids — blank belongs to next user only when unmatched.
      if (cur.turnId && prev.turnId && cur.turnId === prev.turnId) continue;
    } else if (!shouldPairUserWithAssistant(next, cur)) {
      continue;
    }

    out[i] = next;
    out[i + 1] = cur;
    i = Math.max(-1, i - 2);
  }

  return out;
}

function shouldPairUserWithAssistant(
  user: Message,
  assistant: Message,
): boolean {
  if (user.role !== "user" || assistant.role !== "assistant") return false;
  if (user.turnId && assistant.turnId) {
    return user.turnId === assistant.turnId;
  }
  if (isBlankStreamingPlaceholder(assistant)) return true;

  const userTime = user.createdAt;
  const assistantTime = assistant.createdAt;
  if (typeof userTime === "number" && typeof assistantTime === "number") {
    return Math.abs(userTime - assistantTime) <= SAME_USER_MESSAGE_WINDOW_MS;
  }

  if (typeof userTime !== "number" || typeof assistantTime !== "number") {
    return isBlankStreamingPlaceholder(assistant);
  }

  return false;
}

function collapseConsecutiveDuplicates(messages: Message[]): Message[] {
  const result: Message[] = [];
  for (const message of messages) {
    const prev = result[result.length - 1];
    if (prev && prev.role === message.role) {
      if (
        prev.role === "user" &&
        (prev.turnId && message.turnId
          ? prev.turnId === message.turnId
          : prev.content.trim() === message.content.trim())
      ) {
        result[result.length - 1] = mergeMessagePreferRich(prev, message);
        continue;
      }
      if (prev.role === "assistant" && message.role === "assistant") {
        const sameIdentity = sameAssistantIdentity(prev, message);
        const sameTurnBlank =
          prev.turnId &&
          message.turnId &&
          prev.turnId === message.turnId &&
          (isBlankStreamingPlaceholder(prev) ||
            isBlankStreamingPlaceholder(message));
        const blankIntoLive =
          (isBlankStreamingPlaceholder(message) && isLiveStreaming(prev)) ||
          (isBlankStreamingPlaceholder(prev) && isLiveStreaming(message));
        const bothBlank =
          isBlankStreamingPlaceholder(prev) &&
          isBlankStreamingPlaceholder(message);
        if (sameIdentity || sameTurnBlank || blankIntoLive || bothBlank) {
          result[result.length - 1] = mergeMessagePreferRich(prev, message);
          continue;
        }
      }
    }
    result.push(message);
  }
  return result;
}

export function sealCompletedAssistantMessages(
  messages: readonly Message[],
): Message[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    if (!isLiveStreaming(message)) {
      return message.agentFrameComplete
        ? message
        : { ...message, agentFrameComplete: true };
    }
    if (hasAssistantBody(message) || message.agentFrameComplete) {
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

/** Assign synthetic turnIds to legacy transcripts (hydrate path). */
export function assignLegacyTurnIds(messages: readonly Message[]): Message[] {
  if (messages.length === 0) return [];
  if (messages.every((message) => Boolean(message.turnId))) {
    return [...messages];
  }

  const healed = healChatMessageOrder(messages);
  const out: Message[] = [];
  let turnCounter = 0;
  let currentTurnId: string | null = null;

  for (const message of healed) {
    if (message.role === "user") {
      turnCounter += 1;
      currentTurnId = message.turnId?.trim() || `legacy-turn-${turnCounter}`;
      out.push({ ...message, turnId: currentTurnId });
      continue;
    }
    if (message.turnId?.trim()) {
      currentTurnId = message.turnId.trim();
      out.push(message);
      continue;
    }
    if (!currentTurnId) {
      turnCounter += 1;
      currentTurnId = `legacy-turn-${turnCounter}`;
    }
    out.push({ ...message, turnId: currentTurnId });
  }

  return out;
}
