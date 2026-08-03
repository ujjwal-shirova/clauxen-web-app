import type { AgentSegment } from "@/lib/agent-segments";
import { agentSegmentsVisuallyEqual } from "@/lib/agent-segments";
import type { Message } from "@/lib/types";

export type AgentFrame = {
  id: string;
  segments: AgentSegment[];
  complete: boolean;
  startedAtMs: number;
  completedAtMs?: number;
};

export function uniqueAgentFrameId(
  frames: AgentFrame[],
  preferredId: string,
  ignoreIndex?: number,
): string {
  const used = new Set(
    frames.filter((_, index) => index !== ignoreIndex).map((frame) => frame.id),
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
      completedAtMs: message.agentFrameComplete === true ? stamp : undefined,
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

export function activeFrameIndex(
  message: Message,
  frames: AgentFrame[],
): number {
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

export function hasActiveFrameWork(
  frames: AgentFrame[],
  index: number,
): boolean {
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
  // Narration/final text alone is ordinary assistant output. Only explicit
  // thinking or an actual tool call earns activity-timeline chrome.
  return resolveAgentFrames(message).some((frame) =>
    frame.segments.some(
      (segment) => segment.kind === "thinking" || segment.kind === "tool",
    ),
  );
}

/**
 * True when trailing content is an *exact* copy of a progress narration note
 * (legacy duplication). The promoted final segment (isFinal) IS the answer —
 * it must never suppress the answer render.
 *
 * Live mirrored final-round narration (streamed into `content` before
 * answer_finalize) also must not suppress — that is how tokens paint in the
 * answer body instead of teleporting in as a dump on finalize.
 */
export function agentAnswerDuplicatesInterim(message: Message): boolean {
  const trailing = message.content.trim();
  if (!trailing) return false;
  if (isLiveMirroredAnswer(message)) return false;

  return resolveAgentFrames(message).some((frame) =>
    frame.segments.some(
      (segment) =>
        (segment.kind === "narration" || segment.kind === "text") &&
        !(segment.kind === "narration" && segment.isFinal) &&
        segment.content.trim() === trailing,
    ),
  );
}

/**
 * Narration currently mirrored into `message.content` as the live answer.
 * Used to hide the duplicate interim note while the answer body streams.
 */
export function isLiveMirroredAnswer(message: Message): boolean {
  if (message.isStreaming !== true) return false;
  const trailing = message.content.trim();
  if (!trailing) return false;

  const segments = resolveAgentFrames(message).flatMap(
    (frame) => frame.segments,
  );
  if (
    segments.some(
      (segment) =>
        (segment.kind === "tool" && segment.status === "running") ||
        (segment.kind === "thinking" && segment.isStreaming === true),
    )
  ) {
    return false;
  }

  const matchIndex = [...segments]
    .map((segment, index) => ({ segment, index }))
    .reverse()
    .find(
      ({ segment }) =>
        (segment.kind === "narration" || segment.kind === "text") &&
        segment.content.trim() === trailing &&
        (segment.isStreaming === true ||
          (segment.kind === "narration" && segment.isFinal === true)),
    )?.index;
  if (matchIndex == null) return false;

  const hasToolBefore = segments
    .slice(0, matchIndex)
    .some((segment) => segment.kind === "tool");
  const hasAnyTool = segments.some((segment) => segment.kind === "tool");
  return !hasAnyTool || hasToolBefore;
}

/** Stable stream key for the answer body — prefers the narration segment id. */
export function resolveAnswerStreamKey(message: Message): string {
  const trailing = message.content.trim();
  if (trailing) {
    for (const frame of resolveAgentFrames(message)) {
      for (const segment of frame.segments) {
        if (
          (segment.kind === "narration" || segment.kind === "text") &&
          segment.content.trim() === trailing
        ) {
          return segment.id;
        }
      }
    }
  }
  return `${message.id}-answer`;
}

/**
 * Collapse multi-step agent frames into one activity panel.
 *
 * Older streams opened a new frame per tool round; the UI is a single
 * agentic activity for the whole assistant turn.
 */
export function mergeAgentFramesForDisplay(frames: AgentFrame[]): AgentFrame[] {
  if (frames.length <= 1) return frames;

  const withWork = frames.filter((frame) =>
    frameHasWorkSegments(frame.segments),
  );
  if (withWork.length <= 1) return frames;

  const first = withWork[0]!;
  const last = withWork[withWork.length - 1]!;

  const merged: AgentFrame = {
    id: first.id,
    segments: withWork.flatMap((frame) => frame.segments),
    complete: withWork.every((frame) => frame.complete),
    startedAtMs: Math.min(
      ...withWork.map((frame) => frame.startedAtMs || Date.now()),
    ),
    completedAtMs: last.completedAtMs ?? first.completedAtMs,
  };

  const leftovers = frames.filter(
    (frame) => !frameHasWorkSegments(frame.segments),
  );
  return [merged, ...leftovers];
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
      agentSegmentsVisuallyEqual(frame.segments, other.segments)
    );
  });
}
