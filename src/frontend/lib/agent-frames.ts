import type { AgentSegment } from "@/frontend/lib/agent-segments";
import { agentSegmentsVisuallyEqual } from "@/frontend/lib/agent-segments";
import type { Message } from "@/frontend/lib/types";

export type AgentFrame = {
  id: string;
  segments: AgentSegment[];
  complete: boolean;
  startedAtMs: number;
  completedAtMs?: number;
  /** Short acknowledgement emitted before tools in this frame (e.g. "Got it — searching the web"). */
  introNarrative?: string;
  /** Model text emitted after this frame closed and before the next frame opened. */
  interimOutput?: string;
};

export function uniqueAgentFrameId(
  frames: AgentFrame[],
  preferredId: string,
  ignoreIndex?: number,
): string {
  const used = new Set(
    frames
      .filter((_, index) => index !== ignoreIndex)
      .map((frame) => frame.id),
  );
  if (!used.has(preferredId)) return preferredId;

  let suffix = 2;
  let candidate = `${preferredId}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${preferredId}-${suffix}`;
  }
  return candidate;
}

function dedupeAgentFrameIds(frames: AgentFrame[]): AgentFrame[] {
  let changed = false;
  const used = new Set<string>();

  const next = frames.map((frame) => {
    if (!used.has(frame.id)) {
      used.add(frame.id);
      return frame;
    }

    changed = true;
    let suffix = 2;
    let candidate = `${frame.id}-${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${frame.id}-${suffix}`;
    }
    used.add(candidate);
    return { ...frame, id: candidate };
  });

  return changed ? next : frames;
}

export function createAgentFrame(id?: string): AgentFrame {
  const stamp = Date.now();
  return {
    id: id ?? `frame-${stamp}`,
    segments: [],
    complete: false,
    startedAtMs: stamp,
  };
}

/** Normalize legacy single-timeline messages into frame list. */
export function resolveAgentFrames(message: Message): AgentFrame[] {
  if (message.agentFrames?.length) {
    return dedupeAgentFrameIds(message.agentFrames);
  }

  const segments = message.agentSegments ?? [];
  if (segments.length === 0) return [];

  return [
    {
      id: "frame-1",
      segments,
      complete: message.agentFrameComplete === true,
      startedAtMs: Date.now(),
      completedAtMs:
        message.agentFrameComplete === true ? Date.now() : undefined,
    },
  ];
}

export function activeFrameIndex(message: Message, frames: AgentFrame[]): number {
  if (typeof message.activeAgentFrameIndex === "number") {
    return Math.min(
      Math.max(message.activeAgentFrameIndex, 0),
      Math.max(frames.length - 1, 0),
    );
  }
  if (frames.length === 0) return -1;
  const openIndex = frames.findIndex((frame) => !frame.complete);
  return openIndex >= 0 ? openIndex : frames.length - 1;
}

export function hasActiveFrameWork(frames: AgentFrame[], index: number): boolean {
  const frame = frames[index];
  if (!frame || frame.complete) return false;
  return frame.segments.some(
    (segment) =>
      (segment.kind === "thinking" && segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );
}

export function allFramesComplete(frames: AgentFrame[]): boolean {
  return frames.length > 0 && frames.every((frame) => frame.complete);
}

export type OrchestrationBlock =
  | {
      kind: "timeline";
      frame: AgentFrame;
      isActive: boolean;
      /** Current accumulating model narrative (progress text) to show live inside the open frame. */
      liveNarrative?: string;
    }
  | {
      kind: "markdown";
      blockId: string;
      content: string;
      isStreaming: boolean;
    };

function frameHasWorkSegments(segments: AgentSegment[]): boolean {
  return segments.some(
    (segment) => segment.kind === "thinking" || segment.kind === "tool",
  );
}

function frameHasToolSegments(segments: AgentSegment[]): boolean {
  return segments.some((segment) => segment.kind === "tool");
}

export { frameHasWorkSegments, frameHasToolSegments };

/** Agent orchestration UI — reasoning and tools in the same collapsible work frame. */
export function shouldUseAgentMessageLayout(message: Message): boolean {
  return resolveAgentFrames(message).some((frame) =>
    frameHasWorkSegments(frame.segments),
  );
}

/** True when trailing content is an *exact* copy of a captured interim progress note.
 * We only suppress promotion of final answer in that narrow case so the real final output is not lost. */
export function agentAnswerDuplicatesInterim(message: Message): boolean {
  const trailing = message.content.trim();
  if (!trailing) return false;
  // Only exact full match counts as "this is just the old progress note".
  // Partial overlaps or the model naturally reusing a phrase should still show as final.
  return resolveAgentFrames(message).some(
    (frame) =>
      (frame.interimOutput &&
        frame.interimOutput.trim() === trailing) ||
      (frame.introNarrative && frame.introNarrative.trim() === trailing),
  );
}

/** Flat render sequence driven by stream events — no fixed step layout. */
export function resolveOrchestrationBlocks(
  message: Message,
): OrchestrationBlock[] {
  const frames = resolveAgentFrames(message);
  const streaming = message.isStreaming === true;
  const blocks: OrchestrationBlock[] = [];

  const allFramesDone =
    frames.length === 0 ||
    frames.every((frame) => frame.complete) ||
    message.agentFrameComplete === true;

  let lastInterimNarrative: string | undefined;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const isActive =
      streaming && index === frames.length - 1 && !frame.complete;

    if (frame.interimOutput?.trim()) {
      lastInterimNarrative = frame.interimOutput.trim();
    }

    if (frameHasWorkSegments(frame.segments)) {
      blocks.push({
        kind: "timeline",
        frame,
        isActive,
        liveNarrative: isActive ? lastInterimNarrative : undefined,
      });
    }
  }

  const trailingContent = message.content.trim();
  if (trailingContent && !agentAnswerDuplicatesInterim(message)) {
    blocks.push({
      kind: "markdown",
      blockId: `${message.id}-answer`,
      content: message.content,
      isStreaming: streaming && allFramesDone,
    });
  }

  return blocks;
}

export function agentFramesVisuallyEqual(
  a: AgentFrame[] | undefined,
  b: AgentFrame[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((frame, index) => {
    const other = b[index];
    return (
      frame.id === other.id &&
      frame.complete === other.complete &&
      frame.introNarrative === other.introNarrative &&
      frame.interimOutput === other.interimOutput &&
      agentSegmentsVisuallyEqual(frame.segments, other.segments)
    );
  });
}
