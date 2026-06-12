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
