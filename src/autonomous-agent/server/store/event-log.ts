import type { NormalizedEvent } from "@/autonomous-agent/types/events";

type RunEventLog = {
  runId: string;
  conversationId: string;
  events: NormalizedEvent[];
  startedAt: number;
  finishedAt: number | null;
};

const runLogs = new Map<string, RunEventLog>();
const conversationRunIndex = new Map<string, string>();

export function startRunLog(runId: string, conversationId: string): void {
  runLogs.set(runId, {
    runId,
    conversationId,
    events: [],
    startedAt: Date.now(),
    finishedAt: null,
  });
  conversationRunIndex.set(conversationId, runId);
}

export function appendRunEvent(runId: string, event: NormalizedEvent): void {
  const log = runLogs.get(runId);
  if (!log) return;
  log.events.push(event);
}

export function finishRunLog(runId: string): void {
  const log = runLogs.get(runId);
  if (log) log.finishedAt = Date.now();
}

export function getRunEvents(runId: string): NormalizedEvent[] {
  return runLogs.get(runId)?.events ?? [];
}

export function getActiveRunId(conversationId: string): string | null {
  return conversationRunIndex.get(conversationId) ?? null;
}

export function getEventsSinceIndex(
  runId: string,
  fromIndex: number,
): NormalizedEvent[] {
  const events = getRunEvents(runId);
  return events.slice(Math.max(0, fromIndex));
}

export function getLatestRunForConversation(
  conversationId: string,
): RunEventLog | null {
  const runId = conversationRunIndex.get(conversationId);
  if (!runId) return null;
  return runLogs.get(runId) ?? null;
}

/** Trim old runs to bound memory (keeps last 50 runs). */
export function pruneOldRuns(): void {
  if (runLogs.size <= 50) return;
  const sorted = [...runLogs.entries()].sort(
    (a, b) => a[1].startedAt - b[1].startedAt,
  );
  const toRemove = sorted.slice(0, sorted.length - 50);
  for (const [runId] of toRemove) {
    runLogs.delete(runId);
  }
}
