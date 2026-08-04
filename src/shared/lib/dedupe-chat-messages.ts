import type { Message } from "@/lib/types";

/**
 * Collapse duplicate chat rows that can appear from optimistic + realtime +
 * persist races (temp-* → server id, INSERT while streaming, etc.) and heal
 * arrival-order glitches so a user bubble never lands below its own answer.
 *
 * Critical queue-flush rule: a completed previous assistant must never be
 * reattached to the next user or merged into the next live placeholder.
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
  list = healChatMessageOrder(list);
  list = ensureBlankLivePlaceholdersFollowLatestUser(list);
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

/** Answer text, agent timeline, or artifacts — this turn already painted. */
export function hasAssistantBody(message: Message): boolean {
  return contentLen(message) > 0 || hasAgentProgress(message);
}

/**
 * True empty streaming orb — safe to move/merge. Anything with body is a real
 * turn and must stay with its user (especially across queue flushes).
 */
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

  // Never resurrect streaming on a richer completed side when the other is
  // only a blank placeholder — that teleports old answers under new turns.
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
          candidate.content.trim() === message.content.trim(),
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
        // Only merge two blank live placeholders — never a completed/stale-live
        // previous answer into the next turn's empty orb.
        return (
          isBlankStreamingPlaceholder(message) &&
          isBlankStreamingPlaceholder(candidate)
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

/** Two durable user rows written within this window are one logical message. */
const SAME_USER_MESSAGE_WINDOW_MS = 2 * 60 * 1000;

function normalizeUserContent(content: string | undefined): string {
  return (content ?? "").replace(/\s+/g, " ").trim();
}

function isSameLogicalUserMessage(a: Message, b: Message): boolean {
  if (a.role !== "user" || b.role !== "user") return false;
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
      // Stable transcript order: never let insertion noise reorder committed
      // rows that share a stamp — original index wins after role tie-break.
      return a.index - b.index;
    })
    .map(({ message }) => message);

  return healInvertedUserAssistantPairs(sorted);
}

/**
 * Move only blank live placeholders that landed before the latest user.
 * Never relocate assistants that already have answer/timeline body — that is
 * what made previous answers vanish under the queued follow-up.
 */
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
  // Place blanks after the latest user, behind any assistants already there.
  while (
    insertAt < rest.length &&
    rest[insertAt]?.role === "assistant" &&
    !isBlankStreamingPlaceholder(rest[insertAt]!)
  ) {
    insertAt += 1;
  }
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

/** @deprecated Use ensureBlankLivePlaceholdersFollowLatestUser */
export const ensureLiveAssistantsFollowLatestUser =
  ensureBlankLivePlaceholdersFollowLatestUser;

/**
 * Swap adjacent assistant→user inversions when they belong together.
 * Never steal a contentful previous answer from between two users (queue flush).
 */
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

    // Between two users: only blank live placeholders may move to the next user.
    if (prev?.role === "user") {
      if (!isBlankStreamingPlaceholder(cur)) continue;
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
  if (isBlankStreamingPlaceholder(assistant)) return true;

  const userTime = user.createdAt;
  const assistantTime = assistant.createdAt;
  if (typeof userTime === "number" && typeof assistantTime === "number") {
    return Math.abs(userTime - assistantTime) <= SAME_USER_MESSAGE_WINDOW_MS;
  }

  // Undated orphan A before U: only pair blank live placeholders.
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
        prev.content.trim() === message.content.trim()
      ) {
        result[result.length - 1] = mergeMessagePreferRich(prev, message);
        continue;
      }
      if (prev.role === "assistant" && message.role === "assistant") {
        const sameIdentity = sameAssistantIdentity(prev, message);
        const blankIntoLive =
          (isBlankStreamingPlaceholder(message) && isLiveStreaming(prev)) ||
          (isBlankStreamingPlaceholder(prev) && isLiveStreaming(message));
        const bothBlank =
          isBlankStreamingPlaceholder(prev) &&
          isBlankStreamingPlaceholder(message);
        if (sameIdentity || blankIntoLive || bothBlank) {
          result[result.length - 1] = mergeMessagePreferRich(prev, message);
          continue;
        }
      }
    }
    result.push(message);
  }
  return result;
}

/** Seal finished assistants so queue flushes cannot treat them as live. */
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
    // Still flagged live but already has a body from a finished SSE turn —
    // clear streaming so the next queued prompt cannot steal/merge it.
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
