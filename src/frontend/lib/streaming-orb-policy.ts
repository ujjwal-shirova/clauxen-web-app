/**
 * Bottom streaming-orb visibility for assistant messages.
 *
 * Show the orb while the assistant turn is still running, including during
 * thinking / tool timelines. Hide once answer markdown is actively streaming
 * (the text caret replaces the waiting orb).
 */
export function shouldShowAssistantStreamingOrb(input: {
  isStreaming: boolean;
  answerStreaming: boolean;
}): boolean {
  return input.isStreaming && !input.answerStreaming;
}
