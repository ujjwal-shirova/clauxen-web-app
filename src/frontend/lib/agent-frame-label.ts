import type {
  AgentSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";
import { formatDuration } from "@/frontend/lib/clauxen-code/format-duration";

export const PLANNING_NEXT_MOVES_LABEL = "Planning next moves";
export const WORKING_LABEL = "Working";
export const ASKING_QUESTIONS_LABEL = "Asking Questions";
export const ASKED_QUESTIONS_LABEL = "Asked Questions";

function pickTurnVerb(_seed: number): string {
  // Single consistent label — random Brewed/Churned/Cogitated chips stacked
  // poorly when multi-frame; keep one clear agentic summary verb.
  return "Worked";
}

/** Human duration for "Worked for 7m 26s" headers (Clauxen Code formatDuration). */
export function formatWorkedDuration(durationMs: number): string {
  return formatDuration(Math.max(0, durationMs), { hideTrailingZeros: true });
}

/** Cap absurd durations from stale startedAtMs / missing completedAtMs. */
export const MAX_WORKED_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export function resolveWorkedForLabel(input: {
  startedAtMs?: number;
  completedAtMs?: number;
  nowMs?: number;
}): string | null {
  const started = input.startedAtMs;
  if (!started || started <= 0) return null;

  // Prefer a real completion stamp. Falling back to "now" for finished turns
  // rewrites history as (now - started) and can show multi-hour nonsense.
  const end =
    typeof input.completedAtMs === "number" && input.completedAtMs >= started
      ? input.completedAtMs
      : typeof input.nowMs === "number"
        ? input.nowMs
        : null;

  if (end == null) return null;

  let duration = Math.max(0, end - started);
  if (duration > MAX_WORKED_DURATION_MS) {
    duration = MAX_WORKED_DURATION_MS;
  }
  const verb = pickTurnVerb(started);
  return `${verb} for ${formatWorkedDuration(Math.max(1000, duration))}`;
}

function thinkingDurationSeconds(segment: AgentThinkingSegment): number {
  if (segment.durationSeconds) return segment.durationSeconds;
  if (segment.startedAtMs) {
    return Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000));
  }
  return 1;
}

function toolStepLabel(tool: AgentToolSegment): string {
  if (tool.name === "ask_user_input_v0") {
    return tool.status === "running"
      ? ASKING_QUESTIONS_LABEL
      : ASKED_QUESTIONS_LABEL;
  }
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
    tool.name === "present_files" ||
    tool.name === "file_write"
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

/** Short past-tense action phrase per tool, used to build a frame's
 * collapsed summary (e.g. "Searched the web, viewed a file"). */
const TOOL_ACTION_PHRASE: Record<string, string> = {
  web_search: "Searched the web",
  web_fetch: "Read a page",
  file_read: "Viewed a file",
  view: "Viewed a file",
  file_write: "Created a file",
  create_file: "Created a file",
  present_files: "Presented a file",
  bash_tool: "Ran a command",
  run_code_interpreter: "Ran code",
  execute_code: "Ran code",
  read_skill: "Checked a skill",
  weather_fetch: "Checked the weather",
  places_search: "Searched places",
  image_search: "Searched images",
  ask_user_input_v0: ASKED_QUESTIONS_LABEL,
};

function toolActionPhrase(tool: AgentToolSegment): string {
  return (
    TOOL_ACTION_PHRASE[tool.name] ??
    `Used ${tool.name.replace(/_/g, " ")}`
  );
}

/** "Searched the web, viewed a file" — one phrase per distinct tool kind
 * used in this frame, in first-appearance order, lowercased after the first.
 * create_file / file_write alone → filename (Thought-style collapsed chip label). */
function frameSummaryLabel(segments: AgentSegment[]): string | undefined {
  const tools = segments.filter(
    (segment): segment is AgentToolSegment =>
      segment.kind === "tool" && segment.name !== "ask_user_input_v0",
  );
  if (tools.length === 0) return undefined;

  const onlyFileCreates = tools.every(
    (tool) =>
      tool.name === "create_file" ||
      tool.name === "file_write" ||
      tool.name === "present_files",
  );
  if (onlyFileCreates) {
    return toolStepLabel(tools[tools.length - 1]!);
  }

  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const tool of tools) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    phrases.push(toolActionPhrase(tool));
  }

  return phrases
    .map((phrase, index) =>
      index === 0 ? phrase : phrase.charAt(0).toLowerCase() + phrase.slice(1),
    )
    .join(", ");
}

function workSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "tool" ||
      segment.kind === "text",
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
    // Shimmer "Thinking" from the first delta — even before content arrives.
    return "Thinking";
  }

  if (last.kind === "tool" && last.status === "running") {
    return toolStepLabel(last) || "Working";
  }

  if (last.kind === "text" && last.isStreaming) {
    return PLANNING_NEXT_MOVES_LABEL;
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
  return (
    frameSummaryLabel(input.segments) ??
    resolveLastStepLabel(input.segments) ??
    PLANNING_NEXT_MOVES_LABEL
  );
}

export function shouldShimmerFrameHeader(label: string): boolean {
  return (
    label === PLANNING_NEXT_MOVES_LABEL ||
    label === WORKING_LABEL ||
    label === ASKING_QUESTIONS_LABEL ||
    label === "Thinking" ||
    label.startsWith("Thinking")
  );
}
