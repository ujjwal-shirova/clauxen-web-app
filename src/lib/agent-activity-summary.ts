/**
 * Cursor-style activity summaries + live labels for the agent timeline.
 *
 * Plain-string helpers live here so tests stay dependency-free; React
 * rendering of the labels happens in agent-orchestration.tsx.
 */

import type {
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";

export const SEARCH_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "image_search",
]);
export const EDIT_TOOLS = new Set(["create_file", "file_write"]);
export const EXPLORE_TOOLS = new Set([
  "file_read",
  "read_file",
  "grep",
  "glob",
  "list_dir",
  "search_files",
]);
export const SHELL_TOOLS = new Set(["bash_tool", "execute_code"]);

function countLines(content: string): number {
  if (!content) return 0;
  return content.replace(/\n$/, "").split("\n").length;
}

export type ActivityCounts = {
  edited: number;
  explored: number;
  searches: number;
  commands: number;
  mcp: number;
  other: number;
  thinking: boolean;
  insertions: number;
  deletions: number;
  runningTool?: AgentToolSegment;
};

export type ActivitySummaryPart =
  | { kind: "text"; text: string; tone: "muted" | "emphasis" | "subtle" }
  | { kind: "diff"; insertions: number; deletions: number };

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function toolFileContent(segment: AgentToolSegment): string {
  return (
    segment.fileContent ??
    (typeof segment.args?.content === "string"
      ? segment.args.content
      : typeof segment.args?.file_text === "string"
        ? segment.args.file_text
        : "")
  );
}

/** Aggregate tool/thinking counts for a work-group header. */
export function collectActivityCounts(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): ActivityCounts {
  const counts: ActivityCounts = {
    edited: 0,
    explored: 0,
    searches: 0,
    commands: 0,
    mcp: 0,
    other: 0,
    thinking: false,
    insertions: 0,
    deletions: 0,
  };

  for (const segment of segments) {
    if (segment.kind === "thinking") {
      counts.thinking = true;
      continue;
    }
    if (SEARCH_TOOLS.has(segment.name)) counts.searches += 1;
    else if (EDIT_TOOLS.has(segment.name)) {
      counts.edited += 1;
      const content = toolFileContent(segment);
      if (content && segment.status !== "running") {
        counts.insertions += countLines(content);
      }
    } else if (EXPLORE_TOOLS.has(segment.name)) counts.explored += 1;
    else if (SHELL_TOOLS.has(segment.name)) counts.commands += 1;
    else if (segment.name.startsWith("mcp__")) counts.mcp += 1;
    else counts.other += 1;

    if (segment.status === "running") counts.runningTool = segment;
  }

  return counts;
}

/**
 * Structured Cursor-style summary parts.
 * Example: Edited 4 files, explored 7 files, 1 search, ran 1 command +150 -47
 */
export function buildActivitySummaryParts(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  state: "active" | "done",
): ActivitySummaryPart[] {
  const c = collectActivityCounts(segments);
  const active = state === "active";
  const parts: ActivitySummaryPart[] = [];

  const pushMuted = (text: string) =>
    parts.push({ kind: "text", text, tone: "muted" });
  const pushEmphasis = (text: string) =>
    parts.push({ kind: "text", text, tone: "emphasis" });
  const pushSubtle = (text: string) =>
    parts.push({ kind: "text", text, tone: "subtle" });

  const clauses: Array<() => void> = [];

  if (c.edited > 0) {
    clauses.push(() => {
      pushMuted(active ? "Editing " : "Edited ");
      pushEmphasis(String(c.edited));
      pushMuted(` ${pluralize(c.edited, "file", "files")}`);
    });
  }
  if (c.explored > 0) {
    clauses.push(() => {
      pushMuted(active ? "exploring " : "explored ");
      pushEmphasis(String(c.explored));
      pushMuted(` ${pluralize(c.explored, "file", "files")}`);
    });
  }
  if (c.searches > 0) {
    const isLead = clauses.length === 0;
    clauses.push(() => {
      if (isLead) {
        pushMuted(active ? "Searching " : "");
        pushEmphasis(String(c.searches));
        pushMuted(
          ` ${pluralize(c.searches, "search", "searches")}${active ? "…" : ""}`,
        );
      } else {
        pushEmphasis(String(c.searches));
        pushMuted(` ${pluralize(c.searches, "search", "searches")}`);
      }
    });
  }
  if (c.commands > 0) {
    clauses.push(() => {
      pushMuted(active ? "running " : "ran ");
      pushEmphasis(String(c.commands));
      pushMuted(` ${pluralize(c.commands, "command", "commands")}`);
    });
  }
  if (c.mcp > 0) {
    clauses.push(() => {
      pushMuted(active ? "calling " : "called ");
      pushEmphasis(String(c.mcp));
      pushMuted(
        ` ${pluralize(c.mcp, "connector", "connectors")}`,
      );
    });
  }
  if (c.other > 0) {
    clauses.push(() => {
      pushMuted(active ? "using " : "used ");
      pushEmphasis(String(c.other));
      pushMuted(` ${pluralize(c.other, "tool", "tools")}`);
    });
  }

  if (clauses.length === 0) {
    if (c.thinking) {
      if (active) {
        pushMuted("Thinking");
        pushSubtle("…");
      } else {
        pushMuted("Thought");
      }
    } else if (active) {
      pushMuted("Working");
      pushSubtle("…");
    } else {
      pushMuted("Worked");
    }
    return parts;
  }

  // First clause: capitalize lead verb ("Edited", "Ran", …).
  clauses.forEach((render, index) => {
    if (index > 0) pushMuted(", ");
    render();
  });

  // Capitalize the leading muted verb of the finished summary.
  const firstText = parts.find((p) => p.kind === "text");
  if (firstText && firstText.kind === "text" && firstText.text) {
    firstText.text =
      firstText.text.charAt(0).toUpperCase() + firstText.text.slice(1);
  }

  if (
    !active &&
    (c.insertions > 0 || c.deletions > 0) &&
    (c.edited > 0 || c.commands > 0)
  ) {
    parts.push({
      kind: "diff",
      insertions: c.insertions,
      deletions: c.deletions,
    });
  }

  if (active && !parts.some((p) => p.kind === "text" && p.text.includes("…"))) {
    pushSubtle("…");
  }

  return parts;
}

/** Plain-text form of the Cursor summary (tests / a11y). */
export function summarizeActivityPlain(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
  state: "active" | "done",
): string {
  return buildActivitySummaryParts(segments, state)
    .map((part) => {
      if (part.kind === "diff") {
        const bits: string[] = [];
        if (part.insertions > 0) bits.push(`+${part.insertions}`);
        if (part.deletions > 0) bits.push(`-${part.deletions}`);
        return bits.length ? ` ${bits.join(" ")}` : "";
      }
      return part.text;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeToolToken(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function baseNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function truncateLabel(text: string, max = 56): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Live label for the one running tool (drives the timeline header shimmer). */
export function liveToolActivityLabel(tool: AgentToolSegment): string {
  const path =
    tool.filePath ??
    (typeof tool.args?.path === "string" ? tool.args.path : "");
  const file = path ? baseNameFromPath(path) : "";
  switch (tool.name) {
    case "web_search": {
      const query =
        tool.searchQuery ??
        (typeof tool.args?.query === "string" ? tool.args.query : "");
      return query
        ? `Searching "${truncateLabel(query, 42)}"`
        : "Searching the web";
    }
    case "file_read":
      return file ? `Reading ${file}` : "Reading file";
    case "create_file":
    case "file_write":
      return file ? `Editing ${file}` : "Editing file";
    case "bash_tool": {
      const description =
        tool.description ??
        (typeof tool.args?.description === "string"
          ? tool.args.description
          : "");
      return description
        ? `Analyzing ${truncateLabel(description, 42)}`
        : "Analyzing";
    }
    case "execute_code": {
      const description =
        tool.description ??
        (typeof tool.args?.description === "string"
          ? tool.args.description
          : "");
      return description
        ? `Analyzing ${truncateLabel(description, 42)}`
        : "Analyzing";
    }
    case "read_skill":
      return "Loading skill";
    case "places_search":
      return "Searching places";
    case "image_search":
      return "Searching images";
    case "weather":
    case "weather_fetch":
      return "Checking the weather";
    default:
      if (tool.name.startsWith("mcp__")) {
        const parts = tool.name.split("__");
        const toolName = parts.length >= 3 ? parts.slice(2).join("__") : tool.name;
        return `Calling ${humanizeToolToken(toolName)}`;
      }
      return `Using ${humanizeToolToken(tool.name)}`;
  }
}

/**
 * Header label for the unified agent timeline while work is live: the last
 * running tool wins, then an open thinking phase, then a generic fallback.
 */
export function deriveLiveActivityLabel(
  segments: Array<
    AgentThinkingSegment | AgentToolSegment | { kind: string; isStreaming?: boolean }
  >,
): string {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!;
    if (segment.kind === "tool") {
      const tool = segment as AgentToolSegment;
      if (tool.status === "running") return liveToolActivityLabel(tool);
    }
    if (segment.kind === "thinking") {
      const thinking = segment as AgentThinkingSegment;
      if (thinking.isStreaming) return "Thinking";
    }
  }
  return "Working";
}

/** Count work steps (thinking + tools) for the collapsed "N steps" header. */
export function countActivitySteps(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): number {
  let steps = 0;
  for (const segment of segments) {
    if (segment.kind === "thinking") steps += 1;
    else if (segment.kind === "tool" && segment.name !== "present_files") {
      steps += 1;
    }
  }
  return steps;
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
