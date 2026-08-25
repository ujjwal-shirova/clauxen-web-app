import type { AgentStep, AgentToolStep } from "@/lib/agent-trace";

/**
 * Trace summaries — past-tense per-step labels ("Ran 1 search", "Read
 * example.com") and live present-tense labels for the trailing Working-for
 * row. Pure string helpers so tests stay dependency-free.
 */

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

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function toolFileContent(step: AgentToolStep): string {
  return (
    step.fileContent ??
    (typeof step.args?.content === "string"
      ? step.args.content
      : typeof step.args?.file_text === "string"
        ? (step.args.file_text as string)
        : "")
  );
}

/** Short object of a tool call — a query, hostname, path, or command. */
export function toolObjectLabel(tool: AgentToolStep): string {
  if (typeof tool.searchQuery === "string" && tool.searchQuery.trim()) {
    return tool.searchQuery.trim();
  }
  const args = tool.args ?? {};
  if (tool.name === "web_fetch" && typeof args.url === "string") {
    try {
      return new URL(args.url).hostname.replace(/^www\./, "") || args.url;
    } catch {
      return args.url;
    }
  }
  if (typeof args.path === "string" && args.path.trim()) {
    return args.path.split("/").pop() || args.path;
  }
  if (
    (tool.name === "bash_tool" || tool.name === "execute_code") &&
    typeof args.command === "string"
  ) {
    return args.command.replace(/\s+/g, " ").slice(0, 60);
  }
  if (typeof args.description === "string" && args.description.trim()) {
    return args.description.replace(/\s+/g, " ").slice(0, 60);
  }
  if (tool.name.startsWith("mcp__")) {
    // mcp__server__tool → server
    const parts = tool.name.split("__");
    if (parts[1]) return parts[1];
  }
  return "";
}

/** Past-tense label for one completed tool step. */
export function completedToolLabel(tool: AgentToolStep): string {
  if (tool.status === "error") return "Hit an issue";
  switch (tool.name) {
    case "web_search":
      return `Searched for "${truncate(toolObjectLabel(tool), 48)}"`;
    case "web_fetch": {
      const host = toolObjectLabel(tool);
      return host ? `Read ${host}` : "Read a page";
    }
    case "image_search":
      return "Searched images";
    case "places_search":
      return "Looked up places";
    case "weather_fetch":
      return "Checked weather";
    case "bash_tool":
      return "Ran a command";
    case "execute_code":
      return "Ran code";
    case "file_read":
      return `Read ${truncate(toolObjectLabel(tool), 40) || "a file"}`;
    case "create_file":
    case "file_write":
      return `${tool.status === "done" ? (tool.name === "create_file" ? "Created" : "Updated") : "Writing"} ${
        truncate(toolObjectLabel(tool), 40) || "file"
      }`;
    case "read_skill":
      return "Loaded guidance";
    case "ask_user_input_v0":
      return "Asked for input";
    default:
      if (tool.name.startsWith("mcp__")) {
        return `Used ${truncate(toolObjectLabel(tool), 32) || "connector"}`;
      }
      return "Completed a step";
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Present-tense label while a tool runs — shown in the Working-for row. */
export function runningToolLabel(tool: AgentToolStep): string {
  switch (tool.name) {
    case "web_search":
      return `Searching for "${truncate(toolObjectLabel(tool), 42)}"`;
    case "web_fetch":
      return `Reading ${toolObjectLabel(tool) || "a page"}`;
    case "image_search":
      return "Searching images";
    case "places_search":
      return "Looking up places";
    case "weather_fetch":
      return "Checking weather";
    case "bash_tool":
      return "Running a command";
    case "execute_code":
      return "Running code";
    case "file_read":
      return `Reading ${truncate(toolObjectLabel(tool), 36) || "file"}`;
    case "create_file":
    case "file_write":
      return `Writing ${truncate(toolObjectLabel(tool), 36) || "file"}`;
    case "ask_user_input_v0":
      return "Waiting for your answer";
    default:
      if (tool.name.startsWith("mcp__")) {
        return `Using ${truncate(toolObjectLabel(tool), 28) || "connector"}`;
      }
      return "Working";
  }
}

export type TraceSummaryCounts = {
  searches: number;
  reads: number;
  commands: number;
  edits: number;
  connectors: number;
};

export function collectTraceCounts(steps: AgentStep[]): TraceSummaryCounts {
  const counts: TraceSummaryCounts = {
    searches: 0,
    reads: 0,
    commands: 0,
    edits: 0,
    connectors: 0,
  };
  for (const step of steps) {
    if (step.kind !== "tool" || step.status === "error") continue;
    if (SEARCH_TOOLS.has(step.name)) counts.searches += 1;
    else if (EXPLORE_TOOLS.has(step.name)) counts.reads += 1;
    else if (SHELL_TOOLS.has(step.name)) counts.commands += 1;
    else if (EDIT_TOOLS.has(step.name)) counts.edits += 1;
    else if (step.name.startsWith("mcp__")) counts.connectors += 1;
  }
  return counts;
}

/**
 * Aggregate past-tense summary for a finished turn:
 * "Ran 2 searches, read example.com, ran 1 command".
 */
export function summarizeTraceSteps(steps: AgentStep[]): string | null {
  const tools = steps.filter(
    (step): step is AgentToolStep => step.kind === "tool",
  );
  if (tools.length === 0) return null;
  const counts = collectTraceCounts(steps);
  const parts: string[] = [];

  if (counts.searches > 0) {
    parts.push(
      `Ran ${counts.searches} ${pluralize(counts.searches, "search", "searches")}`,
    );
  }
  if (counts.edits > 0) {
    const files = new Set(
      tools
        .filter((tool) => EDIT_TOOLS.has(tool.name))
        .map((tool) => tool.filePath ?? toolObjectLabel(tool))
        .filter(Boolean),
    );
    parts.push(
      `${counts.edits > 1 ? `Edited ${counts.edits} files` : `Edited ${truncate([...files][0] ?? "file", 36)}`}`,
    );
  }
  if (counts.commands > 0) {
    parts.push(
      `Ran ${counts.commands} ${pluralize(counts.commands, "command", "commands")}`,
    );
  }
  if (counts.reads > 0) {
    parts.push(`Read ${pluralize(counts.reads, "source", "sources")}`);
  }
  if (counts.connectors > 0) {
    parts.push(
      `Used ${counts.connectors} ${pluralize(counts.connectors, "connector", "connectors")}`,
    );
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

/** Diff stats for file-edit steps (+N −M lines). */
export function countFileDiffLines(tool: AgentToolStep): {
  insertions: number;
  deletions: number;
} | null {
  if (!EDIT_TOOLS.has(tool.name)) return null;
  const content = toolFileContent(tool);
  if (!content) return null;
  return {
    insertions: content.replace(/\n$/, "").split("\n").length,
    deletions: 0,
  };
}

/** Format elapsed ms as Grok-style compact duration ("3s", "1m 12s"). */
export function formatElapsedSeconds(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
