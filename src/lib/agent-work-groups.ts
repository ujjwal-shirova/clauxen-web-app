import type {
  AgentSegment,
  AgentNarrationSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";
import { deriveActivityLabel } from "@/lib/agent-activity-labels";
import {
  summarizeActivityPlain,
  SEARCH_TOOLS,
  EDIT_TOOLS,
  SHELL_TOOLS,
} from "@/lib/agent-activity-summary";
import { fileNameFromPath } from "@/lib/chat-artifacts";

/**
 * Work groups — chronological tool/thinking steps for the flat agent ledger.
 *
 * Narration is ALWAYS a standalone row outside activity steps. The chat UI
 * renders every member flush-left (no aggregate fold / rail / dots).
 *
 *  narration (outside)
 *  thinking / tools (flush left, no tree indent, no rail/dots)
 */

export type AgentWorkGroup = {
  id: string;
  /** Header derived from tool mix (Cursor) or preceding narration. */
  label: string;
  /** True while any member is streaming/running — header shimmers. */
  isActive: boolean;
  /** @deprecated Narration renders outside groups — kept optional for compat. */
  narration?: AgentNarrationSegment | AgentTextSegment;
  segments: Array<AgentThinkingSegment | AgentToolSegment>;
};

export type AgentTraceItem =
  | { kind: "group"; group: AgentWorkGroup }
  | {
      kind: "narration";
      segment: AgentNarrationSegment | AgentTextSegment;
    };

function isNarration(
  segment: AgentSegment,
): segment is AgentNarrationSegment | AgentTextSegment {
  return segment.kind === "narration" || segment.kind === "text";
}

function isGroupMember(
  segment: AgentSegment,
): segment is AgentThinkingSegment | AgentToolSegment {
  return segment.kind === "thinking" || segment.kind === "tool";
}

/** Fallback / primary Cursor-style header for a tool mix. */
export function summarizeGroupSegments(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  state: "active" | "done",
): string {
  return summarizeActivityPlain(segments, state);
}

/**
 * Prefer narration-derived labels for a single coherent step; otherwise use
 * the Cursor tool-mix summary (Edited N files, 1 search, …).
 */
export function resolveGroupLabel(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  state: "active" | "done",
  labelSource?: string,
): string {
  const toolCount = segments.filter((s) => s.kind === "tool").length;
  const thinkingCount = segments.filter((s) => s.kind === "thinking").length;
  // Multi-step mixes always get Cursor summaries so the header lists counts.
  if (toolCount + thinkingCount >= 2 || toolCount >= 2) {
    return summarizeActivityPlain(segments, state);
  }
  if (labelSource) {
    const derived = deriveActivityLabel(labelSource, state);
    if (derived) return derived;
  }
  return summarizeActivityPlain(segments, state);
}

/**
 * Fold chrome is retired — the transcript is a flat Cursor/Claude ledger.
 * Kept as a predicate for tests/callers; always false.
 */
export function groupNeedsFoldChrome(
  _segments: Array<AgentThinkingSegment | AgentToolSegment>,
): boolean {
  return false;
}

function memberIsLive(
  segment: AgentThinkingSegment | AgentToolSegment,
): boolean {
  return (
    (segment.kind === "thinking" && segment.isStreaming) ||
    (segment.kind === "tool" && segment.status === "running")
  );
}

/**
 * Emit one or more work groups from a buffer.
 *
 * Completed members are sealed into their own past-tense (no-shimmer) group so
 * a later running tool cannot keep earlier steps shimmering. Only the trailing
 * live members stay in an active group.
 */
function emitBufferedGroups(
  buffer: Array<AgentThinkingSegment | AgentToolSegment>,
  labelSource: string | undefined,
  groupCounterStart: number,
): { items: AgentTraceItem[]; nextCounter: number } {
  const filtered = buffer.filter(
    (segment) =>
      segment.kind === "thinking" ||
      (segment.kind === "tool" && segment.name !== "present_files"),
  );
  if (filtered.length === 0) {
    return { items: [], nextCounter: groupCounterStart };
  }

  const items: AgentTraceItem[] = [];
  let groupCounter = groupCounterStart;
  let cursor = 0;

  while (cursor < filtered.length) {
    const head = filtered[cursor]!;
    if (!memberIsLive(head)) {
      let end = cursor + 1;
      while (end < filtered.length && !memberIsLive(filtered[end]!)) {
        end += 1;
      }
      const chunk = filtered.slice(cursor, end);
      groupCounter += 1;
      const useLabel = cursor === 0 ? labelSource : undefined;
      items.push({
        kind: "group",
        group: {
          id: `work-group-${chunk[0]!.id}-${groupCounter}`,
          label: resolveGroupLabel(chunk, "done", useLabel),
          isActive: false,
          segments: chunk,
        },
      });
      cursor = end;
      continue;
    }

    const chunk = filtered.slice(cursor);
    groupCounter += 1;
    const useLabel = cursor === 0 ? labelSource : undefined;
    items.push({
      kind: "group",
      group: {
        id: `work-group-${chunk[0]!.id}-${groupCounter}`,
        label: resolveGroupLabel(chunk, "active", useLabel),
        isActive: true,
        segments: chunk,
      },
    });
    break;
  }

  return { items, nextCounter: groupCounter };
}

/**
 * Fold a frame's segments into standalone narration rows + tool/thinking groups.
 * Narration never nests inside a group body.
 */
export function groupAgentWorkItems(
  segments: AgentSegment[],
): AgentTraceItem[] {
  const items: AgentTraceItem[] = [];
  let buffer: Array<AgentThinkingSegment | AgentToolSegment> = [];
  let labelSource: string | undefined;
  let groupCounter = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const emitted = emitBufferedGroups(buffer, labelSource, groupCounter);
    buffer = [];
    groupCounter = emitted.nextCounter;
    items.push(...emitted.items);
    labelSource = undefined;
  };

  for (const segment of segments) {
    if (isNarration(segment)) {
      if (segment.kind === "narration" && segment.isFinal) continue;
      if (!segment.content.trim() && !segment.isStreaming) continue;

      flush();
      items.push({ kind: "narration", segment });
      if (segment.content.trim()) {
        labelSource = segment.content.trim();
      }
      continue;
    }
    if (isGroupMember(segment)) {
      if (
        buffer.length > 0 &&
        memberIsLive(segment) &&
        buffer.every((member) => !memberIsLive(member))
      ) {
        flush();
      }
      buffer.push(segment);
    }
  }
  flush();
  return items;
}

/** Diff chips for revised files (+N lines / −M lines). */
export function countContentLineDiff(
  content: string,
  previousContent?: string,
): { insertions: number; deletions: number } {
  const insertions =
    content.length === 0 ? 0 : content.replace(/\n$/, "").split("\n").length;
  if (!previousContent) {
    return { insertions, deletions: 0 };
  }
  const deletions =
    previousContent.length === 0
      ? 0
      : previousContent.replace(/\n$/, "").split("\n").length;
  return { insertions, deletions };
}

export { fileNameFromPath, SEARCH_TOOLS, EDIT_TOOLS, SHELL_TOOLS };
