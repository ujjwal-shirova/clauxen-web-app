import type { Message } from "@/lib/types";

/**
 * Collapse duplicate chat rows that can appear from optimistic + realtime +
 * persist races (temp-* → server id, INSERT while streaming, etc.) and heal
 * arrival-order glitches so a user bubble never lands below its own answer.
 *
 * Rules:
 * 1. Prefer durable (non-temp) ids over temp-* / pending-* when content matches.
 * 2. Never let an empty/cold server snapshot kill a live streaming orb.
 * 3. Drop same-message user duplicates even when an assistant row sits
 *    between them (realtime append race) — same content + ephemeral id /
 *    client id link / near-identical timestamps.
 * 4. Heal ordering: sort by createdAt (undated last), and for rows sharing a
 *    persisted timestamp (user + assistant are written in one transaction)
 *    the user always leads its turn. Original index is the final tie-break
 *    so the comparator stays a valid total order.
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

  // Collapse temp user + durable user with identical content (any position).
  list = collapseTempServerPairs(list);

  // Collapse remaining same-turn user duplicates (durable + durable races).
  list = collapseDuplicateUserMessages(list);

  // Heal arrival order before the consecutive sweep so pairing is stable.
  list = healChatMessageOrder(list);

  // Live streaming replies must sit after the latest user bubble — never above.
  list = ensureLiveAssistantsFollowLatestUser(list);

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
        // Two in-flight assistants in one chat are the same turn (optimistic
        // placeholder + durable row / duplicate paint). Merge even when one
        // already has tokens so we never render A_content above U + A_empty.
        return isLiveStreaming(message) && isLiveStreaming(candidate);
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

/** Two durable user rows written within this window are one logical message. */
const SAME_USER_MESSAGE_WINDOW_MS = 2 * 60 * 1000;

function normalizeUserContent(content: string | undefined): string {
  return (content ?? "").replace(/\s+/g, " ").trim();
}

/**
 * True when two user rows are the same logical message despite distinct ids:
 * an optimistic/temp copy, a client-id link, or persisted rows stamped within
 * a tight window (a genuine re-send of identical text minutes later must
 * survive — it is a separate turn).
 */
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

/**
 * Collapse duplicate user bubbles at ANY distance. The realtime/hydrate race
 * appends a durable user row after the streaming assistant, so the temp and
 * durable copies are not always consecutive. Keeps the earliest position.
 */
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

/**
 * Heal arrival-order glitches (realtime INSERT / hydrate appends) so turns
 * pair chronologically. Total order: dated rows first by createdAt; rows
 * sharing a persisted timestamp put the user before its assistant (they are
 * written in one DB transaction); undated rows keep insertion order last.
 * Then fix remaining assistant→user inversions within the pairing window so a
 * user bubble never sits below its own answer.
 */
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

/**
 * Hard guarantee for in-flight turns: every live streaming assistant must sit
 * after the latest user bubble. Fixes the visible bug where answer tokens
 * paint above the user chip while an empty placeholder orb sits below it.
 */
export function ensureLiveAssistantsFollowLatestUser(
  messages: readonly Message[],
): Message[] {
  if (messages.length <= 1) return [...messages];

  let latestUserIndex = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.role === "user") latestUserIndex = i;
  }
  if (latestUserIndex < 0) return [...messages];

  const liveIndexes: number[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]!;
    if (message.role === "assistant" && isLiveStreaming(message)) {
      liveIndexes.push(i);
    }
  }
  if (liveIndexes.length === 0) return [...messages];
  if (liveIndexes.every((index) => index > latestUserIndex)) {
    return [...messages];
  }

  const liveMessages = liveIndexes.map((index) => messages[index]!);
  const liveSet = new Set(liveIndexes);
  const rest = messages.filter((_, index) => !liveSet.has(index));

  let insertAt = 0;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i]?.role === "user") insertAt = i + 1;
  }
  return [...rest.slice(0, insertAt), ...liveMessages, ...rest.slice(insertAt)];
}

/**
 * When a durable user row lands after its assistant (realtime/hydrate race),
 * timestamps often differ by a few ms — equal-stamp sorting alone misses it.
 * Walk adjacent assistant→user inversions and swap when they belong together.
 *
 * Special case: a live/empty streaming assistant sitting between two users is
 * almost always the in-flight reply for the *following* user (optimistic
 * append race: A2 landed before U2). Leaving it attached to the previous user
 * is the follow-up pairing bug.
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
    const liveOrEmpty =
      isLiveStreaming(cur) || contentLen(cur) === 0;

    if (prev?.role === "user") {
      // Completed answer between two users belongs to the previous turn.
      if (!liveOrEmpty) continue;
    } else if (!shouldPairUserWithAssistant(next, cur)) {
      continue;
    }

    out[i] = next;
    out[i + 1] = cur;
    // Re-check one step back in case of A, A, U chains.
    i = Math.max(-1, i - 2);
  }

  return out;
}

function shouldPairUserWithAssistant(
  user: Message,
  assistant: Message,
): boolean {
  if (user.role !== "user" || assistant.role !== "assistant") return false;
  if (isLiveStreaming(assistant) || !assistant.content.trim()) return true;

  const userTime = user.createdAt;
  const assistantTime = assistant.createdAt;
  if (typeof userTime === "number" && typeof assistantTime === "number") {
    return Math.abs(userTime - assistantTime) <= SAME_USER_MESSAGE_WINDOW_MS;
  }

  // Undated / optimistic rows: if a user bubble is adjacent to a live/empty assistant
  // bubble in inverted order, they belong together with the user leading.
  if (typeof userTime !== "number" || typeof assistantTime !== "number") {
    return isLiveStreaming(assistant) || !assistant.content.trim();
  }

  return false;
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
