import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Agent Trace — open specification for recording AI-generated code attribution.
 * @see https://github.com/cursor/agent-trace
 *
 * A trace record describes which files/ranges an AI conversation produced,
 * alongside human authorship, in a version-controlled codebase. This module
 * emits records whenever the Clauxen agent writes or edits a file, so AI
 * contributions are attributable and queryable.
 */

export type ContributorType = "human" | "ai" | "mixed" | "unknown";

export type VcsType = "git" | "jj" | "hg" | "svn";

export interface Vcs {
  type: VcsType;
  revision: string;
}

export interface Tool {
  name: string;
  version?: string;
}

export interface Contributor {
  type: ContributorType;
  /** models.dev convention, e.g. "openai/gpt-5.6" */
  model_id?: string;
}

export interface RelatedResource {
  type: string;
  url: string;
}

export interface Range {
  start_line: number;
  end_line: number;
  content_hash?: string;
  contributor?: Contributor;
}

export interface Conversation {
  url?: string;
  contributor?: Contributor;
  ranges: Range[];
  related?: RelatedResource[];
}

export interface FileEntry {
  path: string;
  conversations: Conversation[];
}

export interface TraceRecord {
  version: string;
  id: string;
  timestamp: string;
  vcs?: Vcs;
  tool?: Tool;
  files: FileEntry[];
  metadata?: Record<string, unknown>;
}

export const AGENT_TRACE_VERSION = "0.1.0";
export const TRACE_PATH = ".agent-trace/traces.jsonl";

const APP_NAME = "clauxen";
const APP_VERSION = "1.0.0";

/** Resolve the repo root for relative paths + VCS revision. */
function getWorkspaceRoot(): string {
  if (process.env.CLAUXEN_PROJECT_DIR) return process.env.CLAUXEN_PROJECT_DIR;
  if (process.env.CURSOR_PROJECT_DIR) return process.env.CURSOR_PROJECT_DIR;
  return process.cwd();
}

function getToolInfo(): Tool {
  return { name: APP_NAME, version: APP_VERSION };
}

function getVcsInfo(root: string): Vcs | undefined {
  try {
    const { execSync } = require("node:child_process") as {
      execSync: (cmd: string, args: string[], opts: { cwd: string; encoding: string }) => string;
    };
    const revision = execSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf-8",
    }).trim();
    return { type: "git", revision };
  } catch {
    return undefined;
  }
}

function toRelativePath(absolutePath: string, root: string): string {
  return absolutePath.startsWith(root) ? relative(root, absolutePath) : absolutePath;
}

/** Normalize a raw model id to the models.dev provider/model convention. */
export function normalizeModelId(model?: string): string | undefined {
  if (!model) return undefined;
  if (model.includes("/")) return model;
  const prefixes: Record<string, string> = {
    "gpt-": "openai",
    "o1": "openai",
    "o3": "openai",
    "gemini-": "google",
    "kimi-": "moonshot",
    "deepseek-": "deepseek",
    "qwen": "alibaba",
  };
  for (const [prefix, provider] of Object.entries(prefixes)) {
    if (model.startsWith(prefix)) return `${provider}/${model}`;
  }
  return model;
}

export interface RangePosition {
  start_line: number;
  end_line: number;
}

/** Compute 1-indexed line ranges for a set of edits against file content. */
export function computeRangePositions(
  edits: Array<{ new_string: string; range?: RangePosition }>,
  fileContent?: string,
): RangePosition[] {
  return edits
    .filter((edit) => edit.new_string)
    .map((edit) => {
      if (edit.range) return edit.range;
      const lineCount = edit.new_string.split("\n").length;
      if (fileContent) {
        const idx = fileContent.indexOf(edit.new_string);
        if (idx !== -1) {
          const startLine = fileContent.substring(0, idx).split("\n").length;
          return { start_line: startLine, end_line: startLine + lineCount - 1 };
        }
      }
      return { start_line: 1, end_line: lineCount };
    });
}

export interface CreateTraceInput {
  /** Contributor type — "ai" for agent-generated files. */
  type?: ContributorType;
  /** Absolute or relative path of the file the agent wrote. */
  filePath: string;
  /** Model id (raw or normalized). */
  model?: string;
  /** Line ranges produced by this conversation. */
  rangePositions?: RangePosition[];
  /** URL to look up the conversation that produced this code. */
  conversationUrl?: string;
  /** Free-form metadata (conversation id, generation id, etc.). */
  metadata?: Record<string, unknown>;
}

/** Build a trace record for a single AI file contribution. */
export function createTrace(input: CreateTraceInput): TraceRecord {
  const root = getWorkspaceRoot();
  const modelId = normalizeModelId(input.model);
  const ranges: Range[] = input.rangePositions?.length
    ? input.rangePositions.map((pos) => ({ ...pos }))
    : [{ start_line: 1, end_line: 1 }];

  const conversation: Conversation = {
    url: input.conversationUrl,
    contributor: { type: input.type ?? "ai", model_id: modelId },
    ranges,
  };

  return {
    version: AGENT_TRACE_VERSION,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    vcs: getVcsInfo(root),
    tool: getToolInfo(),
    files: [
      {
        path: toRelativePath(input.filePath, root),
        conversations: [conversation],
      },
    ],
    metadata: input.metadata,
  };
}

/** Append a trace record as JSONL to the workspace trace log. */
export function appendTrace(trace: TraceRecord): void {
  const root = getWorkspaceRoot();
  const dir = join(root, ".agent-trace");
  const filePath = join(root, TRACE_PATH);
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(filePath, JSON.stringify(trace) + "\n", "utf-8");
  } catch (error) {
    // Tracing is best-effort — never fail the agent turn over attribution.
    console.warn("[agent-trace] append failed:", error);
  }
}

/** Read all trace records from the workspace log. */
export function readTraces(): TraceRecord[] {
  const root = getWorkspaceRoot();
  const filePath = join(root, TRACE_PATH);
    try {
      if (!existsSync(filePath)) return [];
      const { readFileSync } = require("node:fs") as {
        readFileSync: (path: string, encoding: string) => string;
      };
      const raw = readFileSync(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as TraceRecord);
  } catch {
    return [];
  }
}

/** Convenience: build + append a trace in one call. */
export function recordAgentFileContribution(input: CreateTraceInput): TraceRecord {
  const trace = createTrace(input);
  appendTrace(trace);
  return trace;
}
