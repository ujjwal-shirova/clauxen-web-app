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

function groupIsActive(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): boolean {
  return segments.some(
    (segment) =>
      (segment.kind === "thinking" && segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );
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

  const flush = (streamEnded: boolean) => {
    if (buffer.length === 0) return;
    const filtered = buffer.filter(
      (segment) =>
        segment.kind === "thinking" ||
        (segment.kind === "tool" && segment.name !== "present_files"),
    );
    buffer = [];
    if (filtered.length === 0) return;

    const active = groupIsActive(filtered) && !streamEnded;
    const state = active ? "active" : "done";
    const label =
      (labelSource ? deriveActivityLabel(labelSource, state) : undefined) ??
      summarizeGroupSegments(filtered, state);
    groupCounter += 1;
    items.push({
      kind: "group",
      group: {
        id: `work-group-${filtered[0]!.id}-${groupCounter}`,
        label,
        isActive: active,
        segments: filtered,
      },
    });
    // Label applies to the next tool batch only once.
    labelSource = undefined;
  };

  const streamEnded = segments.every(
    (segment) =>
      !(
        (segment.kind === "thinking" && segment.isStreaming) ||
        ((segment.kind === "narration" || segment.kind === "text") &&
          segment.isStreaming) ||
        (segment.kind === "tool" && segment.status === "running")
      ),
  );

  for (const segment of segments) {
    if (isNarration(segment)) {
      if (segment.kind === "narration" && segment.isFinal) continue;
      if (!segment.content.trim() && !segment.isStreaming) continue;

      // Close any open tool group before the next prose row.
      flush(streamEnded);
      items.push({ kind: "narration", segment });
      // Remember this sentence so the following tool group can borrow a label.
      if (segment.content.trim()) {
        labelSource = segment.content.trim();
      }
      continue;
    }
    if (isGroupMember(segment)) {
      buffer.push(segment);
    }
  }
  flush(streamEnded);
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
