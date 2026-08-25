import type { Message } from "@/lib/types";

/** Default copy when something goes wrong mid-chat (no technical details). */
export const USER_FACING_CHAT_ERROR =
  "Something unexpected happened. Please try again.";

/** Persisted when the model closes a turn with no visible answer text. */
export const EMPTY_ASSISTANT_RESPONSE_FALLBACK =
  "I couldn't produce a response for that message. Please try again.";

const GENERATION_ERROR_PREFIXES = [
  USER_FACING_CHAT_ERROR,
  EMPTY_ASSISTANT_RESPONSE_FALLBACK,
  "Something unexpected happened",
  "I couldn't produce a response",
  "We couldn't complete that reply",
  "Connection lost while generating",
  "Connection was interrupted",
  "Generation failed",
  "The response stream ended before completion",
  "Failed to generate response",
  "This chat is already generating a response",
  "Security check in progress",
];

const TECHNICAL_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /already generating|generation_in_progress|chat_turn_exists|previous reply is still finishing|still finishing|message is saved and queued/i,
    message:
      "We couldn't start that reply just yet. Please try again in a moment.",
  },
  {
    test: /security check|security_challenge|just a moment|cf-mitigated|challenge-platform|vercel-challenge/i,
    message: "Security check in progress. Please retry in a moment.",
  },
  {
    test: /failed to fetch|networkerror|load failed|network request failed|stream ended|response stream ended|ECONNRESET|ETIMEDOUT|timeout|aborted|abort/i,
    message: "Connection was interrupted. Please try again.",
  },
  {
    test: /\b403\b|forbidden|unauthorized|\b401\b|not authenticated|invalid api key|api key/i,
    message: USER_FACING_CHAT_ERROR,
  },
  {
    test: /\b429\b|rate limit|too many requests|quota|capacity|overloaded/i,
    message: "We're a bit busy right now. Please wait a moment and try again.",
  },
  {
    test: /\b5\d\d\b|internal server|bad gateway|service unavailable|openai|provider|inference/i,
    message: USER_FACING_CHAT_ERROR,
  },
  {
    test: /generation failed|failed to generate|error:/i,
    message: USER_FACING_CHAT_ERROR,
  },
];

/** True when the assistant already painted useful work — soft-complete instead of failing. */
export function hasUsefulAssistantProgress(
  message: Pick<Message, "content" | "agentTrace">,
): boolean {
  if (message.content?.trim()) return true;
  const segments = message.agentTrace?.steps ?? [];
  return segments.some((segment) => {
    if (segment.kind === "tool") {
      return (
        segment.status === "done" ||
        segment.status === "running" ||
        Boolean(segment.result?.trim()) ||
        Boolean(segment.searchResults?.length) ||
        Boolean(segment.fileContent?.trim())
      );
    }
    if (segment.kind === "narration") {
      return Boolean(segment.content.trim()) || Boolean(segment.isStreaming);
    }
    if (segment.kind === "thinking") {
      return true;
    }
    return false;
  });
}

/**
 * Map any raw/API/provider error into a short user-facing sentence.
 * Never forward status codes, stack traces, or vendor names to the chat UI.
 */
export function toUserFacingChatError(raw: unknown): string {
  const text =
    typeof raw === "string"
      ? raw.trim()
      : raw instanceof Error
        ? raw.message.trim()
        : "";
  if (!text) return USER_FACING_CHAT_ERROR;

  // Already sanitized in a previous pass.
  if (
    text === USER_FACING_CHAT_ERROR ||
    text.startsWith("Something unexpected happened") ||
    text.startsWith("We couldn't start that reply") ||
    text.startsWith("Connection was interrupted") ||
    text.startsWith("We're a bit busy right now") ||
    text.startsWith("Security check in progress")
  ) {
    return text;
  }

  for (const entry of TECHNICAL_PATTERNS) {
    if (entry.test.test(text)) return entry.message;
  }

  // Unknown / vendor payload — never show raw text in the transcript.
  return USER_FACING_CHAT_ERROR;
}

/** True when an assistant turn should be treated as a failed generation. */
export function isAssistantGenerationError(
  message: Pick<Message, "role" | "content" | "generationFailed">,
): boolean {
  if (message.role !== "assistant") return false;
  if (message.generationFailed === true) return true;
  const content = message.content.trim();
  if (!content) return false;
  return GENERATION_ERROR_PREFIXES.some((prefix) => content.startsWith(prefix));
}
