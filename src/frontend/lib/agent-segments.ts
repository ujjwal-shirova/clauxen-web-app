export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  favicon?: string;
  highlights?: string[];
};

export type AgentThinkingSegment = {
  kind: "thinking";
  id: string;
  /** Model-authored task-specific label parsed from <agent_heading>. */
  heading?: string;
  content: string;
  isStreaming?: boolean;
  durationSeconds?: number;
  startedAtMs?: number;
};

export type AgentNarrationSegment = {
  kind: "narration";
  id: string;
  content: string;
  isStreaming?: boolean;
};

/** @deprecated Persisted v1 transcripts used `text` for narration. */
export type AgentTextSegment = {
  kind: "text";
  id: string;
  content: string;
  isStreaming?: boolean;
};

export type AgentToolSegment = {
  kind: "tool";
  id: string;
  toolCallId: string;
  name: string;
  status: "running" | "done" | "error";
  description?: string;
  args?: Record<string, unknown>;
  /** false while args are still streaming (typing) in; true/undefined once
   * the call is finalized and execution has started or finished. */
  argsComplete?: boolean;
  result?: string;
  stdout?: string;
  stderr?: string;
  searchQuery?: string;
  searchResults?: WebSearchResult[];
  filePath?: string;
  fileContent?: string;
  fileLanguage?: string;
  startedAtMs?: number;
  completedAtMs?: number;
};

export type AgentStepDoneSegment = {
  kind: "step_done";
  id: string;
  label?: string;
};

export type AgentSegment =
  | AgentThinkingSegment
  | AgentNarrationSegment
  | AgentTextSegment
  | AgentToolSegment
  | AgentStepDoneSegment;

export function parseToolResult(result: string): unknown {
  try {
    return JSON.parse(result) as unknown;
  } catch {
    return result;
  }
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Detect in-place segment streaming updates (memo-safe). */
export function agentSegmentsVisuallyEqual(
  left?: AgentSegment[],
  right?: AgentSegment[],
): boolean {
  if ((left?.length ?? 0) !== (right?.length ?? 0)) return false;
  if (!left || !right) return true;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a.id !== b.id || a.kind !== b.kind) return false;

    if (a.kind === "thinking" && b.kind === "thinking") {
      if (
        a.content !== b.content ||
        a.heading !== b.heading ||
        a.isStreaming !== b.isStreaming ||
        a.durationSeconds !== b.durationSeconds ||
        a.startedAtMs !== b.startedAtMs
      ) {
        return false;
      }
      continue;
    }

    if (
      (a.kind === "text" || a.kind === "narration") &&
      (b.kind === "text" || b.kind === "narration")
    ) {
      if (a.content !== b.content || a.isStreaming !== b.isStreaming) {
        return false;
      }
      continue;
    }

    if (a.kind === "tool" && b.kind === "tool") {
      if (
        a.status !== b.status ||
        a.searchQuery !== b.searchQuery ||
        a.stdout !== b.stdout ||
        a.stderr !== b.stderr ||
        a.description !== b.description ||
        a.result !== b.result ||
        a.startedAtMs !== b.startedAtMs ||
        a.completedAtMs !== b.completedAtMs ||
        a.argsComplete !== b.argsComplete ||
        (a.searchResults?.length ?? 0) !== (b.searchResults?.length ?? 0)
      ) {
        return false;
      }
      // args streams in progressively (e.g. bash_tool's command typing in
      // before execution) — compare by value, not just the fields above.
      if (a.args !== b.args) {
        const aKeys = Object.keys(a.args ?? {});
        const bKeys = Object.keys(b.args ?? {});
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
          if (a.args?.[key] !== b.args?.[key]) return false;
        }
      }
      const aResults = a.searchResults ?? [];
      const bResults = b.searchResults ?? [];
      for (let resultIndex = 0; resultIndex < aResults.length; resultIndex += 1) {
        if (aResults[resultIndex]?.url !== bResults[resultIndex]?.url) {
          return false;
        }
      }
    }
  }

  return true;
}
