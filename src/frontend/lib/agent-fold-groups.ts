import type {
  AgentSegment,
  AgentNarrationSegment,
  AgentTextSegment,
  AgentToolSegment,
  AgentThinkingSegment,
} from "@/frontend/lib/agent-segments";

export type AgentFoldSummary = {
  fileCount: number;
  searchCount: number;
  toolCount: number;
  label: string;
};

export type AgentTraceItem =
  | {
      kind: "fold";
      id: string;
      segments: Array<AgentThinkingSegment | AgentToolSegment>;
      summary: AgentFoldSummary;
      isActive: boolean;
    }
  | {
      kind: "narration";
      segment: AgentNarrationSegment | AgentTextSegment;
    };

const SEARCH_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "image_search",
]);

const FILE_TOOLS = new Set([
  "create_file",
  "file_write",
  "present_files",
]);

function isNarration(
  segment: AgentSegment,
): segment is AgentNarrationSegment | AgentTextSegment {
  return segment.kind === "narration" || segment.kind === "text";
}

function isFoldMember(
  segment: AgentSegment,
): segment is AgentThinkingSegment | AgentToolSegment {
  return segment.kind === "thinking" || segment.kind === "tool";
}

function classifyTool(tool: AgentToolSegment): "file" | "search" | "tool" {
  if (FILE_TOOLS.has(tool.name)) return "file";
  if (SEARCH_TOOLS.has(tool.name)) return "search";
  return "tool";
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Build the Cursor-style fold header label.
 * Counts files / searches / other tools — never thinking duration.
 */
export function summarizeFoldSegments(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  options?: { isActive?: boolean },
): AgentFoldSummary {
  let fileCount = 0;
  let searchCount = 0;
  let toolCount = 0;

  for (const segment of segments) {
    if (segment.kind !== "tool") continue;
    const kind = classifyTool(segment);
    if (kind === "file") fileCount += 1;
    else if (kind === "search") searchCount += 1;
    else toolCount += 1;
  }

  const parts: string[] = [];
  if (fileCount > 0) parts.push(pluralize(fileCount, "file", "files"));
  if (searchCount > 0) parts.push(pluralize(searchCount, "search", "searches"));
  if (toolCount > 0) parts.push(pluralize(toolCount, "tool", "tools"));

  let label: string;
  if (parts.length === 0) {
    label = options?.isActive ? "Thinking…" : "Thought";
  } else if (fileCount > 0 || searchCount > 0) {
    label = `Explored ${parts.join(", ")}`;
  } else {
    label = `Used ${parts.join(", ")}`;
  }

  return { fileCount, searchCount, toolCount, label };
}

/**
 * Group consecutive thinking+tool segments into fold blocks.
 * Narration breaks folds and stays outside (between expanders).
 */
export function groupAgentTraceItems(
  segments: AgentSegment[],
): AgentTraceItem[] {
  const items: AgentTraceItem[] = [];
  let buffer: Array<AgentThinkingSegment | AgentToolSegment> = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const isActive = buffer.some(
      (segment) =>
        (segment.kind === "thinking" && segment.isStreaming) ||
        (segment.kind === "tool" && segment.status === "running"),
    );
    items.push({
      kind: "fold",
      id: `fold-${buffer[0]!.id}`,
      segments: buffer,
      summary: summarizeFoldSegments(buffer, { isActive }),
      isActive,
    });
    buffer = [];
  };

  for (const segment of segments) {
    if (isNarration(segment)) {
      flush();
      if (segment.content.trim() || segment.isStreaming) {
        items.push({ kind: "narration", segment });
      }
      continue;
    }
    if (isFoldMember(segment)) {
      buffer.push(segment);
      continue;
    }
  }
  flush();
  return items;
}

/** Naive line-level rewrite stats for create_file chrome. */
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
