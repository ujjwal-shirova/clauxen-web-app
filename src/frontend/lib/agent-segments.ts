export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  highlights?: string[];
};

export type AgentThinkingSegment = {
  kind: "thinking";
  id: string;
  content: string;
  isStreaming?: boolean;
  durationSeconds?: number;
  startedAtMs?: number;
};

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
        (a.searchResults?.length ?? 0) !== (b.searchResults?.length ?? 0)
      ) {
        return false;
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
