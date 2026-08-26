/**
 * Agent trace — the single durable activity model for an assistant turn.
 *
 * One flat, ordered list of steps per turn (replaces the old
 * frames + segments + work-groups trio):
 *
 *   thinking  — provider-supplied interleaved reasoning summary + duration
 *   narration — first-person progress prose ("I'm searching the web for X…")
 *   tool      — a tool/connector/bash/search invocation with lifecycle
 *
 * The final answer lives in Message.content as before; narration steps that
 * end up being the final round's answer text are promoted via
 * `answer_finalize` and flagged `isFinal` so the UI can hide the duplicate
 * interim row.
 */

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  favicon?: string;
  highlights?: string[];
};

export type AgentStepBase = {
  id: string;
  startedAtMs?: number;
  completedAtMs?: number;
};

export type AgentThinkingStep = AgentStepBase & {
  kind: "thinking";
  /** Provider-supplied reasoning summary streamed for the expandable trace. */
  content?: string;
  /** True while this reasoning phase is live. */
  isStreaming?: boolean;
  durationSeconds?: number;
};

export type AgentNarrationStep = AgentStepBase & {
  kind: "narration";
  content: string;
  /** Number of provider deltas folded into this row. One-shot activity notes
   * stay in the trace; multi-delta final prose can stream in the answer body. */
  deltaCount?: number;
  isStreaming?: boolean;
  /** True once promoted to the durable final answer (answer_finalize). */
  isFinal?: boolean;
};

export type AgentToolStatus = "running" | "done" | "error";

export type AgentToolStep = AgentStepBase & {
  kind: "tool";
  toolCallId: string;
  name: string;
  status: AgentToolStatus;
  description?: string;
  args?: Record<string, unknown>;
  /** false while args stream in (typing); true once finalized. */
  argsComplete?: boolean;
  result?: string;
  stdout?: string;
  stderr?: string;
  searchQuery?: string;
  searchResults?: WebSearchResult[];
  filePath?: string;
  fileContent?: string;
  fileLanguage?: string;
};

export type AgentStep = AgentThinkingStep | AgentNarrationStep | AgentToolStep;

/** Persisted turn state on Message. */
export type AgentTraceState = {
  steps: AgentStep[];
  /** True when the whole turn finished (stream done / error soft-complete). */
  complete?: boolean;
  /** Turn start — drives the Working-for timer. */
  startedAtMs?: number;
  completedAtMs?: number;
};

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

export function createAgentTrace(startedAtMs = Date.now()): AgentTraceState {
  return { steps: [], startedAtMs };
}

export function findToolStep(
  steps: AgentStep[],
  toolCallId: string,
): AgentToolStep | undefined {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.kind === "tool" && step.toolCallId === toolCallId) return step;
  }
  return undefined;
}

/**
 * True when any step of the turn is live (running tool / streaming thinking /
 * streaming narration) — drives the trailing Working-for shimmer row.
 */
export function agentTraceIsActive(
  trace: AgentTraceState | undefined,
): boolean {
  if (!trace || trace.complete) return false;
  return trace.steps.some((step) => {
    if (step.kind === "tool") return step.status === "running";
    if (step.kind === "thinking") return step.isStreaming === true;
    return step.isStreaming === true;
  });
}

/** A trace earns timeline chrome only when real work happened. */
export function traceHasWork(steps: AgentStep[]): boolean {
  return steps.some(
    (step) =>
      step.kind === "thinking" ||
      step.kind === "tool" ||
      (step.kind === "narration" &&
        !step.isFinal &&
        step.content.trim().length > 0),
  );
}

/**
 * Memo-safe equality for live patching. Compares every render-relevant field,
 * including progressive args values (bash commands typing in).
 */
export function agentStepsVisuallyEqual(
  left?: AgentStep[],
  right?: AgentStep[],
): boolean {
  if ((left?.length ?? 0) !== (right?.length ?? 0)) return false;
  if (!left || !right) return true;

  const shallowArgsEqual = (
    a: Record<string, unknown> | undefined,
    b: Record<string, unknown> | undefined,
  ): boolean => {
    if (a === b) return true;
    const aKeys = Object.keys(a ?? {});
    const bKeys = Object.keys(b ?? {});
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if ((a ?? {})[key] !== (b ?? {})[key]) return false;
    }
    return true;
  };

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a.id !== b.id || a.kind !== b.kind) return false;

    if (a.kind === "thinking" && b.kind === "thinking") {
      if (
        a.content !== b.content ||
        a.isStreaming !== b.isStreaming ||
        a.durationSeconds !== b.durationSeconds
      ) {
        return false;
      }
      continue;
    }

    if (
      a.kind === "narration" &&
      b.kind === "narration" &&
      a.content === b.content &&
      a.deltaCount === b.deltaCount &&
      a.isStreaming === b.isStreaming &&
      a.isFinal === b.isFinal
    ) {
      continue;
    }

    if (a.kind === "tool" && b.kind === "tool") {
      if (
        a.status !== b.status ||
        a.name !== b.name ||
        a.searchQuery !== b.searchQuery ||
        a.stdout !== b.stdout ||
        a.stderr !== b.stderr ||
        a.description !== b.description ||
        a.result !== b.result ||
        a.startedAtMs !== b.startedAtMs ||
        a.completedAtMs !== b.completedAtMs ||
        a.argsComplete !== b.argsComplete ||
        (a.searchResults?.length ?? 0) !== (b.searchResults?.length ?? 0) ||
        !shallowArgsEqual(a.args, b.args)
      ) {
        return false;
      }
      const aResults = a.searchResults ?? [];
      const bResults = b.searchResults ?? [];
      for (let i = 0; i < aResults.length; i += 1) {
        if (aResults[i]?.url !== bResults[i]?.url) return false;
      }
      continue;
    }

    return false;
  }

  return true;
}
