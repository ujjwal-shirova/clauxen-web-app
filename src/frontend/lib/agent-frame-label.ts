import type {
  AgentSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";

export const PLANNING_NEXT_MOVES_LABEL = "Planning next moves";

function thinkingDurationSeconds(segment: AgentThinkingSegment): number {
  if (segment.durationSeconds) return segment.durationSeconds;
  if (segment.startedAtMs) {
    return Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000));
  }
  return 1;
}

function toolStepLabel(tool: AgentToolSegment): string {
  if (tool.name === "web_search" || tool.name === "web_fetch") {
    return (
      tool.searchQuery ??
      (typeof tool.args?.query === "string" ? tool.args.query : "Web search")
    );
  }
  if (tool.name === "bash_tool" || tool.name === "run_code_interpreter") {
    const stdout = tool.stdout?.trim();
    if (stdout) return tool.description ?? "Ran command";
    return tool.description ?? "Running command";
  }
  if (
    tool.name === "create_file" ||
    tool.name === "str_replace" ||
    tool.name === "present_files"
  ) {
    const path =
      tool.filePath ??
      (typeof tool.args?.path === "string" ? tool.args.path : "");
    return path ? fileNameFromPath(path) : "Created file";
  }
  return (
    tool.description ??
    tool.name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function workSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) => segment.kind === "thinking" || segment.kind === "tool",
  );
}

function toolHasVisibleOutput(tool: AgentToolSegment): boolean {
  if (tool.name === "web_search" || tool.name === "web_fetch") {
    if (tool.searchQuery?.trim()) return true;
    if (typeof tool.args?.query === "string" && tool.args.query.trim()) {
      return true;
    }
    if ((tool.searchResults?.length ?? 0) > 0) return true;
    return false;
  }
  if (tool.name === "bash_tool" || tool.name === "run_code_interpreter") {
    return Boolean(tool.stdout?.trim() || tool.stderr?.trim());
  }
  if (tool.description?.trim()) return true;
  if (tool.args && Object.keys(tool.args).length > 0) return true;
  return false;
}

/** Label for the in-flight step while work is still running. */
export function resolveActiveStepLabel(
  segments: AgentSegment[],
): string | undefined {
  const items = workSegments(segments);
  const last = items[items.length - 1];
  if (!last) return undefined;

  if (last.kind === "thinking") {
    if (!last.isStreaming) return undefined;
    return last.content.trim() ? "Thinking" : undefined;
  }

  if (last.kind === "tool" && last.status === "running") {
    if (!toolHasVisibleOutput(last)) return undefined;
    return toolStepLabel(last);
  }

  return undefined;
}

/** Last completed timeline step — never returns "Done" (that stays on the wire only). */
export function resolveLastStepLabel(
  segments: AgentSegment[],
): string | undefined {
  const items = workSegments(segments);

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const segment = items[index];
    if (segment.kind === "thinking") {
      if (segment.isStreaming) return "Thinking";
      if (!segment.content.trim()) continue;
      return `Thought for ${thinkingDurationSeconds(segment)}s`;
    }
    if (segment.kind === "tool") {
      if (segment.status === "running") return undefined;
      return toolStepLabel(segment);
    }
  }

  return undefined;
}

export function resolveFrameHeaderLabel(input: {
  segments: AgentSegment[];
  hasActiveWork: boolean;
}): string {
  if (input.hasActiveWork) {
    return resolveActiveStepLabel(input.segments) ?? PLANNING_NEXT_MOVES_LABEL;
  }
  return resolveLastStepLabel(input.segments) ?? PLANNING_NEXT_MOVES_LABEL;
}

export function shouldShimmerFrameHeader(label: string): boolean {
  return label === PLANNING_NEXT_MOVES_LABEL;
}
