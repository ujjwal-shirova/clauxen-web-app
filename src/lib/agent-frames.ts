import type { AgentSegment } from "@/lib/agent-segments";
import { agentSegmentsVisuallyEqual } from "@/lib/agent-segments";
import type { Message } from "@/lib/types";

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
      ((segment.kind === "thinking" ||
        segment.kind === "narration" ||
        segment.kind === "text") &&
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
      ((segment.kind === "narration" || segment.kind === "text") &&
        segment.content.trim().length > 0),
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
  return resolveAgentFrames(message).some((frame) => {
    if (
      (frame.interimOutput && frame.interimOutput.trim() === trailing) ||
      (frame.introNarrative && frame.introNarrative.trim() === trailing)
    ) {
      return true;
    }
    // Pre-tool prose is moved into narration segments when tools start; after
    // hydrate it can also linger in message.content — suppress the duplicate.
    return frame.segments.some(
      (segment) =>
        (segment.kind === "narration" || segment.kind === "text") &&
        segment.content.trim() === trailing,
    );
  });
}

/**
 * Collapse multi-step agent frames into one activity panel.
 *
 * Older streams opened a new "Brewed/Churned for …" frame per tool round.
 * The product UI is a single agentic activity for the whole assistant turn.
 */
export function mergeAgentFramesForDisplay(frames: AgentFrame[]): AgentFrame[] {
  if (frames.length <= 1) return frames;

  const withWork = frames.filter((frame) =>
    frameHasWorkSegments(frame.segments),
  );
  if (withWork.length <= 1) return frames;

  const first = withWork[0]!;
  const last = withWork[withWork.length - 1]!;
  const segments = withWork.flatMap((frame) => frame.segments);
  const introParts = withWork
    .map((frame) => frame.introNarrative?.trim())
    .filter(Boolean) as string[];
  const interimParts = withWork
    .map((frame) => frame.interimOutput?.trim())
    .filter(Boolean) as string[];

  const merged: AgentFrame = {
    id: first.id,
    segments,
    complete: withWork.every((frame) => frame.complete),
    startedAtMs: Math.min(...withWork.map((frame) => frame.startedAtMs || Date.now())),
    completedAtMs: last.completedAtMs ?? first.completedAtMs,
    introNarrative: introParts[0],
    interimOutput: interimParts.join("\n\n") || undefined,
  };

  // Preserve non-work frames (shouldn't exist) after the merged activity.
  const leftovers = frames.filter(
    (frame) => !frameHasWorkSegments(frame.segments),
  );
  return [merged, ...leftovers];
}

/** Flat render sequence — one activity panel, then the final answer. */
export function resolveOrchestrationBlocks(
  message: Message,
): OrchestrationBlock[] {
  const frames = mergeAgentFramesForDisplay(resolveAgentFrames(message));
  const streaming = message.isStreaming === true;
  const blocks: OrchestrationBlock[] = [];

  let lastInterimNarrative: string | undefined;
  let introShown = false;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const isActive =
      streaming && index === frames.length - 1 && !frame.complete;

    if (frame.interimOutput?.trim()) {
      lastInterimNarrative = frame.interimOutput.trim();
    }

    const introNarrative = frame.introNarrative?.trim();

    // Show at most one intro whisper above the activity panel.
    if (introNarrative && !introShown) {
      introShown = true;
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
  // Final answer stays below activity — never inside the collapsible panel.
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
      frame.startedAtMs === other.startedAtMs &&
      frame.completedAtMs === other.completedAtMs &&
      frame.introNarrative === other.introNarrative &&
      frame.interimOutput === other.interimOutput &&
      agentSegmentsVisuallyEqual(frame.segments, other.segments)
    );
  });
}
