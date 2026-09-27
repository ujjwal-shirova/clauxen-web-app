/**
 * Bottom streaming-orb visibility for assistant messages.
 *
 * Show the waiting orb while the turn is running and the answer has not
 * started. Once answer tokens stream, the caret moves to the end of the
 * answer instead. Never show when idle.
 */
export function shouldShowAssistantStreamingOrb(input: {
  isStreaming: boolean;
  answerStreaming: boolean;
  /** When false, force-hide even if a stale message.isStreaming flag remains. */
  chatIsGenerating?: boolean;
}): boolean {
  if (input.chatIsGenerating === false) return false;
  return input.isStreaming === true && input.answerStreaming !== true;
}
