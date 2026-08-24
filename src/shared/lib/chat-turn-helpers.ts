import type { Message } from "@/lib/types";
import { deriveTurnIdFromClientId } from "@/lib/chat-turn-id";

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

function messageKeys(message: Message): string[] {
  return [message.id, message.clientId].filter(
    (value): value is string => Boolean(value),
  );
}

function indexMessages(messages: readonly Message[]): Map<string, Message> {
  const index = new Map<string, Message>();
  for (const message of messages) {
    for (const key of messageKeys(message)) {
      index.set(key, message);
    }
  }
  return index;
}

function lookupMessage(
  index: Map<string, Message>,
  message: Message,
): Message | undefined {
  for (const key of messageKeys(message)) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/** Prefer the richer body; keep live streaming flags from the local row. */
export function mergeChatMessage(
  existing: Message,
  incoming: Message,
): Message {
  const existingLive = isLive(existing);
  const incomingLive = isLive(incoming);
  const existingLen = existing.content?.trim().length ?? 0;
  const incomingLen = incoming.content?.trim().length ?? 0;

  if (existingLive && !incomingLive && existingLen >= incomingLen) {
    return {
      ...incoming,
      ...existing,
      turnId: existing.turnId ?? incoming.turnId,
      clientId: existing.clientId ?? incoming.clientId ?? existing.id,
      isStreaming: true,
    };
  }
  if (incomingLive && !existingLive && incomingLen >= existingLen) {
    return {
      ...existing,
      ...incoming,
      turnId: incoming.turnId ?? existing.turnId,
      clientId: incoming.clientId ?? existing.clientId ?? incoming.id,
      isStreaming: true,
    };
  }

  const prefer =
    incomingLen > existingLen ||
    (incoming.agentFrames?.length ?? 0) > (existing.agentFrames?.length ?? 0)
      ? incoming
      : existing;
  const other = prefer === incoming ? existing : incoming;

  return {
    ...other,
    ...prefer,
    id: incoming.id || existing.id,
    turnId: prefer.turnId ?? other.turnId,
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    content: existingLen >= incomingLen ? existing.content : incoming.content,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
    attachments: existing.attachments ?? incoming.attachments,
    isStreaming: existingLive || incomingLive ? prefer.isStreaming : false,
    isThinkingStreaming:
      existing.isThinkingStreaming || incoming.isThinkingStreaming
        ? prefer.isThinkingStreaming
        : false,
  };
}

/**
 * Merge a server snapshot with the in-memory transcript.
 *
 * Live turns always keep local rows so a follow-up cannot wipe the previous
 * assistant. Idle hydrates prefer the snapshot that still has answers, which
 * also lets branch switches replace the list when counts match.
 */
export function unionChatTranscript(
  local: readonly Message[],
  remote: readonly Message[],
  options?: { live?: boolean },
): Message[] {
  if (local.length === 0) return [...remote];
  if (remote.length === 0) return [...local];

  const live = options?.live === true;
  const localAnswers = local.filter(
    (message) => message.role === "assistant" && hasBody(message),
  ).length;
  const remoteAnswers = remote.filter(
    (message) => message.role === "assistant" && hasBody(message),
  ).length;
  const preferLocal = live || localAnswers > remoteAnswers;

  if (!preferLocal) {
    const localIndex = indexMessages(local);
    const usedLocal = new Set<Message>();
    const merged = remote.map((incoming) => {
      const existing = lookupMessage(localIndex, incoming);
      if (existing) usedLocal.add(existing);
      return existing ? mergeChatMessage(existing, incoming) : incoming;
    });
    // A colder snapshot can omit a previous assistant (common on follow-up
    // hydrate). Keep local answers the server has not echoed yet.
    for (const existing of local) {
      if (usedLocal.has(existing)) continue;
      if (existing.role === "assistant" && hasBody(existing)) {
        merged.push(existing);
      }
    }
    return merged;
  }

  const remoteIndex = indexMessages(remote);
  const used = new Set<Message>();
  const merged = local.map((existing) => {
    const incoming = lookupMessage(remoteIndex, existing);
    if (!incoming) return existing;
    used.add(incoming);
    return mergeChatMessage(existing, incoming);
  });
  for (const incoming of remote) {
    if (used.has(incoming)) continue;
    if (incoming.role === "assistant" && !hasBody(incoming)) continue;
    merged.push(incoming);
  }
  return merged;
}

/**
 * Assign synthetic turnIds to legacy transcripts (hydrate path) so the
 * turn-native store can group them. Rows that already carry a turnId are
 * left untouched.
 */
export function assignLegacyTurnIds(messages: readonly Message[]): Message[] {
  if (messages.length === 0) return [];
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

/**
 * Clear stale live flags on finished assistants so a queue flush cannot
 * treat a completed turn as still streaming.
 */
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
