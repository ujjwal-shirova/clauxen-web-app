import type { Message } from "@/frontend/lib/types";
import {
  activeFrameIndex,
  hasActiveFrameWork,
  resolveAgentFrames,
} from "@/frontend/lib/agent-frames";

/** Plain answer streaming — skip heavy frame reducer until agent work appears. */
export function shouldFastPatchAnswerDelta(message: Message): boolean {
  if (!message.agentMode) return true;
  const frames = resolveAgentFrames(message);
  if (frames.length === 0) return true;
  const idx = activeFrameIndex(message, frames);
  return !hasActiveFrameWork(frames, idx);
}

export function patchAnswerDelta(
  message: Message,
  delta: string,
): Message {
  return {
    ...message,
    content: message.content + delta,
    isStreaming: true,
    isThinkingStreaming: false,
  };
}
