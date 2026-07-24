import type {
  AgentSegment,
  AgentNarrationSegment,
  AgentTextSegment,
  AgentToolSegment,
  AgentThinkingSegment,
} from "@/lib/agent-segments";
import { fileNameFromPath } from "@/lib/chat-artifacts";

export type AgentFoldSummary = {
  fileCount: number;
  searchCount: number;
  toolCount: number;
  label: string;
  verb: string;
};

export type AgentTraceItem =
  | {
      kind: "fold";
      id: string;
      /**
       * Outer summary chrome ("Searched the web", "Used 2 tools").
       * False for bare singles: lone Thought, lone create_file chip, lone search.
       */
      useChrome: boolean;
      segments: Array<AgentThinkingSegment | AgentToolSegment>;
      summary: AgentFoldSummary;
      isActive: boolean;
    }
  | {
      kind: "narration";
      segment: AgentNarrationSegment | AgentTextSegment;
    };

const SEARCH_TOOLS = new Set(["web_search", "web_fetch", "image_search"]);
const FILE_TOOLS = new Set(["create_file", "file_write"]);

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
  // Ignore deprecated present_files in summaries
  if (tool.name === "present_files") return "tool";
  return "tool";
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Fold chrome is for multi-step work only.
 * Bare: lone thinking, lone create_file, lone search, lone bash.
 * Chrome: thinking+tool(s), or 2+ tools.
 */
export function shouldUseFoldChrome(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  options?: { isActive?: boolean },
): boolean {
  const visible = segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      (segment.kind === "tool" && segment.name !== "present_files"),
  );
  let toolCount = 0;
  let thinkingCount = 0;
  for (const segment of visible) {
    if (segment.kind === "tool") toolCount += 1;
    else if (segment.kind === "thinking") thinkingCount += 1;
  }
  if (toolCount >= 2) return true;
  if (toolCount >= 1 && thinkingCount >= 1) return true;
  // Live multi-step still uses chrome once a tool is running alongside prior steps
  if (options?.isActive && toolCount >= 1 && visible.length >= 2) return true;
  return false;
}

function resolveActiveVerb(input: {
  fileCount: number;
  searchCount: number;
  toolCount: number;
  runningTool?: AgentToolSegment;
}): string {
  const running = input.runningTool;
  if (running) {
    if (SEARCH_TOOLS.has(running.name)) return "Searching";
    if (FILE_TOOLS.has(running.name)) return "Writing";
    if (running.name === "bash_tool" || running.name === "run_code_interpreter") {
      return "Running";
    }
    return "Working";
  }
  if (input.searchCount > 0) return "Searching";
  if (input.fileCount > 0) return "Writing";
  if (input.toolCount > 0) return "Working";
  return "Thinking";
}

function resolveDoneVerb(input: {
  fileCount: number;
  searchCount: number;
  toolCount: number;
}): string {
  if (input.searchCount > 0 && input.fileCount === 0 && input.toolCount === 0) {
    return "Searched";
  }
  if (input.fileCount > 0 && input.searchCount === 0 && input.toolCount === 0) {
    return "Wrote";
  }
  if (input.fileCount > 0 || input.searchCount > 0) return "Worked across";
  if (input.toolCount > 0) return "Used";
  return "Thought";
}

export function summarizeFoldSegments(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  options?: { isActive?: boolean },
): AgentFoldSummary {
  let fileCount = 0;
  let searchCount = 0;
  let toolCount = 0;
  let runningTool: AgentToolSegment | undefined;

  for (const segment of segments) {
    if (segment.kind === "thinking") continue;
    if (segment.kind !== "tool") continue;
    if (segment.name === "present_files") continue;
    const kind = classifyTool(segment);
    if (kind === "file") fileCount += 1;
    else if (kind === "search") searchCount += 1;
    else toolCount += 1;
    if (segment.status === "running") runningTool = segment;
  }

  const parts: string[] = [];
  if (fileCount > 0) parts.push(pluralize(fileCount, "file", "files"));
  if (searchCount > 0) parts.push(pluralize(searchCount, "search", "searches"));
  if (toolCount > 0) parts.push(pluralize(toolCount, "tool", "tools"));

  const isActive = options?.isActive === true;
  const verb = isActive
    ? resolveActiveVerb({ fileCount, searchCount, toolCount, runningTool })
    : resolveDoneVerb({ fileCount, searchCount, toolCount });

  let label: string;
  if (parts.length === 0) {
    label = isActive ? `${verb}…` : verb;
  } else if (isActive) {
    label = `${verb} ${parts.join(", ")}…`;
  } else {
    label = `${verb} ${parts.join(", ")}`;
  }

  return { fileCount, searchCount, toolCount, label, verb };
}

/** @deprecated preview line removed from UI; kept for tests. */
export function resolveFoldLivePreview(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): string | undefined {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!;
    if (segment.kind === "tool" && segment.status === "running") {
      if (segment.name === "web_search" || segment.name === "web_fetch") {
        const query =
          segment.searchQuery ??
          (typeof segment.args?.query === "string"
            ? segment.args.query
            : typeof segment.args?.url === "string"
              ? segment.args.url
              : "");
        return query ? `Searching · ${query}` : "Searching the web";
      }
      if (segment.name === "create_file" || segment.name === "file_write") {
        const path =
          segment.filePath ??
          (typeof segment.args?.path === "string" ? segment.args.path : "");
        const name = path ? fileNameFromPath(path) : "file";
        return `Writing ${name}`;
      }
      if (segment.name === "bash_tool" || segment.name === "run_code_interpreter") {
        const description =
          segment.description ??
          (typeof segment.args?.description === "string"
            ? segment.args.description
            : typeof segment.args?.command === "string"
              ? segment.args.command
              : "command");
        return `Running · ${description}`;
      }
      return `Using ${segment.name.replace(/_/g, " ")}`;
    }
    if (segment.kind === "thinking" && segment.isStreaming) {
      return "Thinking";
    }
  }
  return undefined;
}

/**
 * Group consecutive thinking+tool segments into fold blocks.
 * Narration breaks folds and stays outside. present_files is dropped.
 */
export function groupAgentTraceItems(
  segments: AgentSegment[],
): AgentTraceItem[] {
  const items: AgentTraceItem[] = [];
  let buffer: Array<AgentThinkingSegment | AgentToolSegment> = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const filtered = buffer.filter(
      (segment) =>
        segment.kind === "thinking" ||
        (segment.kind === "tool" && segment.name !== "present_files"),
    );
    buffer = [];
    if (filtered.length === 0) return;

    const isActive = filtered.some(
      (segment) =>
        (segment.kind === "thinking" && segment.isStreaming) ||
        (segment.kind === "tool" && segment.status === "running"),
    );
    items.push({
      kind: "fold",
      id: `fold-${filtered[0]!.id}`,
      useChrome: shouldUseFoldChrome(filtered, { isActive }),
      segments: filtered,
      summary: summarizeFoldSegments(filtered, { isActive }),
      isActive,
    });
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
