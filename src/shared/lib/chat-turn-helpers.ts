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
