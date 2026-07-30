import type {
  AgentSegment,
  AgentNarrationSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";
import { deriveActivityLabel } from "@/lib/agent-activity-labels";
import { fileNameFromPath } from "@/lib/chat-artifacts";

/**
 * Work groups — collapsible tool/thinking steps.
 *
 * Narration is ALWAYS a standalone row outside the timeline. When the model
 * announces a step and then runs tools, the label is derived from that
 * preceding narration, but the prose itself stays outside the rail.
 *
 *  narration (outside)
 *  ⌄ work group header (past/gerund)
 *    | thinking / tools
 */

export type AgentWorkGroup = {
  id: string;
  /** Header derived from the preceding narration (or a tool-mix fallback). */
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

const SEARCH_TOOLS = new Set(["web_search", "web_fetch", "image_search"]);
const FILE_TOOLS = new Set(["create_file", "file_write"]);
const SHELL_TOOLS = new Set(["bash_tool", "execute_code"]);

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

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Fallback header for groups with no narration lead-in (tool-mix summary). */
export function summarizeGroupSegments(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  state: "active" | "done",
): string {
  let fileCount = 0;
  let searchCount = 0;
  let shellCount = 0;
  let mcpCount = 0;
  let toolCount = 0;
  let thinking = false;
  let runningTool: AgentToolSegment | undefined;

  for (const segment of segments) {
    if (segment.kind === "thinking") {
      thinking = true;
      continue;
    }
    if (SEARCH_TOOLS.has(segment.name)) searchCount += 1;
    else if (FILE_TOOLS.has(segment.name)) fileCount += 1;
    else if (SHELL_TOOLS.has(segment.name)) shellCount += 1;
    else if (segment.name.startsWith("mcp__")) mcpCount += 1;
    else toolCount += 1;
    if (segment.status === "running") runningTool = segment;
  }

  const parts: string[] = [];
  if (searchCount > 0) parts.push(pluralize(searchCount, "search", "searches"));
  if (fileCount > 0) parts.push(pluralize(fileCount, "file", "files"));
  if (shellCount > 0) parts.push(pluralize(shellCount, "command", "commands"));
  if (mcpCount > 0)
    parts.push(pluralize(mcpCount, "connector call", "connector calls"));
  if (toolCount > 0) parts.push(pluralize(toolCount, "tool", "tools"));

  const active = state === "active";
  let verb: string;
  if (active) {
    if (runningTool) {
      if (SEARCH_TOOLS.has(runningTool.name)) verb = "Searching";
      else if (FILE_TOOLS.has(runningTool.name)) verb = "Writing";
      else if (SHELL_TOOLS.has(runningTool.name)) verb = "Running";
      else verb = "Working";
    } else if (searchCount > 0) verb = "Searching";
    else if (fileCount > 0) verb = "Writing";
    else if (shellCount > 0) verb = "Running";
    else if (toolCount > 0 || mcpCount > 0) verb = "Working";
    else verb = "Thinking";
  } else {
    if (searchCount > 0 && parts.length === 1) verb = "Searched the web";
    else if (fileCount > 0 && parts.length === 1) verb = "Wrote";
    else if (shellCount > 0 && parts.length === 1) verb = "Ran";
    else if (parts.length > 0) verb = "Used";
    else verb = thinking ? "Thought" : "Worked";
  }

  if (parts.length === 0) {
    return active ? `${verb}…` : verb;
  }
  if (verb === "Searched the web") {
    return active ? `Searching ${parts.join(", ")}…` : verb;
  }
  return active
    ? `${verb} ${parts.join(", ")}…`
    : `${verb} ${parts.join(", ")}`;
}

function memberIsLive(
  segment: AgentThinkingSegment | AgentToolSegment,
): boolean {
  return (
    (segment.kind === "thinking" && segment.isStreaming) ||
    (segment.kind === "tool" && segment.status === "running")
  );
}

function groupIsActive(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): boolean {
  return segments.some(memberIsLive);
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
      // Pack consecutive completed members into one done group.
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
          label:
            (useLabel ? deriveActivityLabel(useLabel, "done") : undefined) ??
            summarizeGroupSegments(chunk, "done"),
          isActive: false,
          segments: chunk,
        },
      });
      cursor = end;
      continue;
    }

    // Trailing live members — single active group.
    const chunk = filtered.slice(cursor);
    groupCounter += 1;
    const useLabel = cursor === 0 ? labelSource : undefined;
    items.push({
      kind: "group",
      group: {
        id: `work-group-${chunk[0]!.id}-${groupCounter}`,
        label:
          (useLabel ? deriveActivityLabel(useLabel, "active") : undefined) ??
          summarizeGroupSegments(chunk, "active"),
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
  /** Label source from the most recent narration — not rendered inside the group. */
  let labelSource: string | undefined;
  let groupCounter = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const emitted = emitBufferedGroups(buffer, labelSource, groupCounter);
    buffer = [];
    groupCounter = emitted.nextCounter;
    items.push(...emitted.items);
    // Label applies to the next tool batch only once.
    labelSource = undefined;
  };

  for (const segment of segments) {
    if (isNarration(segment)) {
      if (segment.kind === "narration" && segment.isFinal) continue;
      if (!segment.content.trim() && !segment.isStreaming) continue;

      // Close any open tool group before the next prose row.
      flush();
      items.push({ kind: "narration", segment });
      // Remember this sentence so the following tool group can borrow a label.
      if (segment.content.trim()) {
        labelSource = segment.content.trim();
      }
      continue;
    }
    if (isGroupMember(segment)) {
      // When a new live tool arrives after completed ones, seal the done
      // batch immediately so its header stops shimmering.
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

export { fileNameFromPath };
