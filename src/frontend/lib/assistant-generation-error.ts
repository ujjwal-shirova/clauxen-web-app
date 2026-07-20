import type { Message } from "@/frontend/lib/types";

const GENERATION_ERROR_PREFIXES = [
  "Connection lost while generating",
  "Generation failed",
  "The response stream ended before completion",
  "Failed to generate response",
  "This chat is already generating a response",
];

/** True when an assistant turn should be treated as a failed generation. */
export function isAssistantGenerationError(
  message: Pick<Message, "role" | "content" | "generationFailed">,
): boolean {
  if (message.role !== "assistant") return false;
  if (message.generationFailed === true) return true;
  const content = message.content.trim();
  if (!content) return false;
  return GENERATION_ERROR_PREFIXES.some((prefix) =>
    content.startsWith(prefix),
  );
}
