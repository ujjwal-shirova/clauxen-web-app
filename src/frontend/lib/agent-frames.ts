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
  const raw = message.agentFrames?.length
    ? dedupeAgentFrameIds(message.agentFrames)
    : null;

  if (raw) {
    return raw.map(clampFrameDuration);
  }

  const segments = message.agentSegments ?? [];
  if (segments.length === 0) return [];

  const stamp = message.createdAt ?? Date.now();
  return [
    clampFrameDuration({
      id: "frame-1",
      segments,
      complete: message.agentFrameComplete === true,
      startedAtMs: stamp,
      completedAtMs:
        message.agentFrameComplete === true ? stamp : undefined,
    }),
  ];
}

const MAX_FRAME_DURATION_MS = 2 * 60 * 60 * 1000;

function clampFrameDuration(frame: AgentFrame): AgentFrame {
  const started = frame.startedAtMs;
  if (!started || started <= 0) return frame;
  let completed = frame.completedAtMs;
  if (frame.complete && (completed == null || completed < started)) {
    completed = started;
  }
  if (
    typeof completed === "number" &&
    completed - started > MAX_FRAME_DURATION_MS
  ) {
    completed = started;
  }
  if (completed === frame.completedAtMs) return frame;
  return { ...frame, completedAtMs: completed };
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
      ((segment.kind === "thinking" || segment.kind === "text") &&
        segment.isStreaming) ||
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
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "tool" ||
      (segment.kind === "text" && segment.content.trim().length > 0),
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

  let lastInterimNarrative: string | undefined;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const isActive =
      streaming && index === frames.length - 1 && !frame.complete;

    if (frame.interimOutput?.trim()) {
      lastInterimNarrative = frame.interimOutput.trim();
    }

    const introNarrative = frame.introNarrative?.trim();

    if (introNarrative) {
      blocks.push({
        kind: "markdown",
        blockId: `${frame.id}-intro`,
        content: introNarrative,
        isStreaming: false,
      });
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
  // Never hoist final answer into the work timeline — keep the vertical
  // timeline anchored above the streaming answer.
  if (
    trailingContent &&
    !agentAnswerDuplicatesInterim(message)
  ) {
    blocks.push({
      kind: "markdown",
      blockId: `${message.id}-answer`,
      content: message.content,
      isStreaming: streaming,
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
