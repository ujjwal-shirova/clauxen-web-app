/**
 * Bottom streaming-orb visibility for assistant messages.
 *
 * Show the orb while the assistant turn is still running and answer markdown
 * has not started yet (planning / thinking / tools). Hide once answer tokens
 * stream — the markdown reveal replaces the waiting orb. Never show when idle.
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
