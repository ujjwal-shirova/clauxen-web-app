import type { Message } from "@/lib/types";

/**
 * UI completion gate for answer-only chrome (sources and message actions).
 * Agent streams can briefly stop emitting while a tool result is reconciled;
 * `agentFrameComplete` prevents that pause from exposing final-answer UI.
 */
export function hasCompletedAssistantOutput(message: Message): boolean {
  if (message.role !== "assistant" || !message.content.trim()) return false;
  if (message.isStreaming === true || message.isThinkingStreaming === true) {
    return false;
  }
  if (message.agentMode === true && message.agentFrameComplete !== true) {
    return false;
  }
  return true;
}
