import type { AgentSegment } from "@/frontend/lib/agent-segments";
import { agentSegmentsVisuallyEqual } from "@/frontend/lib/agent-segments";
import type { Message } from "@/frontend/lib/types";

export type AgentFrame = {
  id: string;
  segments: AgentSegment[];
  complete: boolean;
  startedAtMs: number;
  completedAtMs?: number;
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

/** True when trailing content is an *exact* copy of a captured interim progress note.
 * We only suppress promotion of final answer in that narrow case so the real final output is not lost. */
export function agentAnswerDuplicatesInterim(message: Message): boolean {
  const trailing = message.content.trim();
  if (!trailing) return false;
  // Only exact full match counts as "this is just the old progress note".
  // Partial overlaps or the model naturally reusing a phrase should still show as final.
  return resolveAgentFrames(message).some(
    (frame) =>
      frame.interimOutput &&
      frame.interimOutput.trim() === trailing &&
      // If the frame is complete and we have a longer or different final, don't suppress.
      trailing.length > 0,
  );
}

/** Flat render sequence driven by stream events — no fixed step layout. */
export function resolveOrchestrationBlocks(
  message: Message,
): OrchestrationBlock[] {
  const frames = resolveAgentFrames(message);
  const streaming = message.isStreaming === true;
  const blocks: OrchestrationBlock[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const isActive =
      streaming && index === frames.length - 1 && !frame.complete;

    if (frameHasWorkSegments(frame.segments)) {
      const block: Extract<OrchestrationBlock, { kind: "timeline" }> = {
        kind: "timeline",
        frame,
        isActive,
      };
      // For the currently active (last, not complete) work frame, expose the latest model content
      // as live narrative so the autonomous "delta outputs" ("let me search...", "good results...") appear
      // inside the vertical frame while it is still open.
      if (isActive && streaming) {
        const current = message.content?.trim();
        if (current) block.liveNarrative = current;
      }
      blocks.push(block);
    }

    if (frame.interimOutput?.trim()) {
      blocks.push({
        kind: "markdown",
        blockId: `${frame.id}-interim`,
        content: frame.interimOutput,
        isStreaming: false,
      });
    }
  }

  const trailing = message.content.trim();
  if (trailing && !agentAnswerDuplicatesInterim(message)) {
    const activeIdx = frames.findIndex((frame) => !frame.complete);
    const suppressForLiveWork =
      streaming &&
      activeIdx >= 0 &&
      hasActiveFrameWork(frames, activeIdx);

    // Once all frames are complete (or explicitly marked), never suppress the final answer.
    const allFramesDone =
      frames.length === 0 ||
      frames.every((frame) => frame.complete) ||
      message.agentFrameComplete === true;

    if (!suppressForLiveWork || allFramesDone) {
      blocks.push({
        kind: "markdown",
        blockId: `${message.id}-answer`,
        content: message.content,
        isStreaming: streaming && !allFramesDone && frames.length > 0,
      });
    }
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
      frame.interimOutput === other.interimOutput &&
      agentSegmentsVisuallyEqual(frame.segments, other.segments)
    );
  });
}
