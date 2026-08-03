import type { Message } from "@/lib/types";
import type { AgentToolSegment } from "@/lib/agent-segments";
import {
  activeFrameIndex,
  hasActiveFrameWork,
  resolveAgentFrames,
} from "@/lib/agent-frames";

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

export function canFastAppendAnswer(message: Message | undefined): boolean {
  return Boolean(message && shouldFastPatchAnswerDelta(message));
}

export function patchToolOutputDelta(
  message: Message,
  input: {
    toolCallId: string;
    kind: "stdout" | "stderr";
    delta: string;
  },
): Message {
  if (!input.delta) return message;

  const frames = resolveAgentFrames(message);
  const frameIdx = activeFrameIndex(message, frames);
  const frame = frames[frameIdx];
  if (!frame) return message;

  const segmentIdx = frame.segments.findIndex(
    (segment): segment is AgentToolSegment =>
      segment.kind === "tool" && segment.toolCallId === input.toolCallId,
  );
  if (segmentIdx < 0) return message;

  const key = input.kind === "stderr" ? "stderr" : "stdout";
  const nextSegments = [...frame.segments];
  const tool = nextSegments[segmentIdx] as AgentToolSegment;
  nextSegments[segmentIdx] = {
    ...tool,
    [key]: `${tool[key] ?? ""}${input.delta}`,
  };

  const nextFrames = [...frames];
  nextFrames[frameIdx] = { ...frame, segments: nextSegments };

  return {
    ...message,
    agentFrames: nextFrames,
    agentSegments: nextSegments,
    activeAgentFrameIndex: frameIdx,
    isStreaming: true,
  };
}
