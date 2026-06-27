import { finalizeChatTitleStrippedAnswer } from "@/lib/chat-title";
import { stripAssistantStreamArtifacts } from "@/lib/assistant-output-sanitize";

/**
 * Strip UI-only / agent artifacts from text before sending to the model.
 * Keeps user-visible answer text only — no thinking tags, title markup,
 * agent frames, or tool scaffolding — so prompt caches stay stable and
 * input tokens (and repeated large context) stay low for Novita.
 */
export function stripMessageContentForModelApi(content: string): string {
  let cleaned = content
    // thinking blocks (various forms)
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    // agent work frames / orchestration markers that should never reach the model
    .replace(/<agent[^>]*>[\s\S]*?<\/agent>/gi, "")
    .replace(/\[agent[^[\]]*\]/gi, "")
    .replace(/\[frame-[^\]]+\]/gi, "")
    .replace(/<frame[^>]*>[\s\S]*?<\/frame>/gi, "")
    // tool call scaffolding that may leak into visible text in some paths
    .replace(/<tool-call[\s\S]*?<\/tool-call>/gi, "")
    .replace(/\[tool:[^\]]+\]/gi, "");

  return stripAssistantStreamArtifacts(
    finalizeChatTitleStrippedAnswer(cleaned),
  ).trim();
}

export type ModelConversationTurn = {
  role: "user" | "assistant" | "system";
  content: string;
};

/** Normalize client turns to the minimal shape providers cache on. */
export function normalizeModelConversationTurns(
  turns: Array<{ role: string; content: string }>,
): ModelConversationTurn[] {
  return turns
    .filter(
      (turn) =>
        (turn.role === "user" ||
          turn.role === "assistant" ||
          turn.role === "system") &&
        typeof turn.content === "string",
    )
    .map((turn) => ({
      role: turn.role as ModelConversationTurn["role"],
      content: stripMessageContentForModelApi(turn.content),
    }))
    .filter((turn) => turn.content.length > 0);
}
