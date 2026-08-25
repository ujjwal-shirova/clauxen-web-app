import type { Message } from "@/lib/types";
import type {
  AgentStep,
  AgentTraceState,
  WebSearchResult,
} from "@/lib/agent-trace";
import type { ChatArtifact } from "@/lib/chat-artifacts";

const MAX_BRANCH_MESSAGES = 500;
const MAX_CONTENT_CHARS = 256 * 1024;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, max = MAX_CONTENT_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeAgentStep(value: unknown): AgentStep | null {
  const row = asRecord(value);
  if (!row) return null;
  const kind = asString(row.kind);
  const id =
    asString(row.id) ?? `seg-${Math.random().toString(36).slice(2, 10)}`;
  if (kind === "thinking") {
    return {
      kind: "thinking",
      id,
      isStreaming: Boolean(row.isStreaming),
      durationSeconds:
        typeof row.durationSeconds === "number"
          ? row.durationSeconds
          : undefined,
      startedAtMs:
        typeof row.startedAtMs === "number" ? row.startedAtMs : undefined,
    };
  }
  if (kind === "narration") {
    return {
      kind,
      id,
      content: asString(row.content) ?? "",
      isStreaming: Boolean(row.isStreaming),
      ...(row.isFinal === true ? { isFinal: true as const } : {}),
    };
  }
  if (kind === "tool") {
    const searchResults = Array.isArray(row.searchResults)
      ? (row.searchResults
          .map((item): WebSearchResult | null => {
            const result = asRecord(item);
            if (!result) return null;
            const title = asString(result.title);
            const url = asString(result.url);
            if (!title || !url) return null;
            const publishedDate = asString(result.publishedDate);
            const favicon = asString(result.favicon);
            const highlights = Array.isArray(result.highlights)
              ? result.highlights
                  .map((h) => asString(h))
                  .filter((h): h is string => Boolean(h))
              : undefined;
            return {
              title,
              url,
              snippet: asString(result.snippet) ?? "",
              ...(publishedDate ? { publishedDate } : {}),
              ...(favicon ? { favicon } : {}),
              ...(highlights && highlights.length > 0 ? { highlights } : {}),
            };
          })
          .filter(
            (item): item is WebSearchResult => item !== null,
          ) as WebSearchResult[])
      : undefined;
    return {
      kind: "tool",
      id,
      toolCallId: asString(row.toolCallId) ?? id,
      name: asString(row.name) ?? "tool",
      status:
        row.status === "running" || row.status === "error"
          ? row.status
          : "done",
      description: asString(row.description),
      args: asRecord(row.args) ?? undefined,
      argsComplete:
        typeof row.argsComplete === "boolean" ? row.argsComplete : undefined,
      result: asString(row.result, MAX_CONTENT_CHARS),
      stdout: asString(row.stdout, MAX_CONTENT_CHARS),
      stderr: asString(row.stderr, MAX_CONTENT_CHARS),
      searchQuery: asString(row.searchQuery),
      searchResults:
        searchResults && searchResults.length > 0 ? searchResults : undefined,
      filePath: asString(row.filePath),
      fileContent: asString(row.fileContent, MAX_CONTENT_CHARS),
      fileLanguage: asString(row.fileLanguage),
      startedAtMs:
        typeof row.startedAtMs === "number" ? row.startedAtMs : undefined,
      completedAtMs:
        typeof row.completedAtMs === "number" ? row.completedAtMs : undefined,
    };
  }
  return null;
}

/** Accept legacy frame blobs and normalize into the flat trace state. */
function sanitizeAgentTrace(value: unknown): AgentTraceState | null {
  if (Array.isArray(value)) {
    const steps = value
      .map(sanitizeAgentStep)
      .filter((step): step is AgentStep => Boolean(step));
    return steps.length > 0 ? { steps } : null;
  }
  const row = asRecord(value);
  if (!row) return null;
  // New shape: AgentTraceState.
  if (Array.isArray(row.steps)) {
    const steps = row.steps
      .map(sanitizeAgentStep)
      .filter((step): step is AgentStep => Boolean(step));
    if (steps.length === 0 && !Array.isArray(row.segments)) return null;
    const source = Array.isArray(row.segments)
      ? row.segments
          .map(sanitizeAgentStep)
          .filter((step): step is AgentStep => Boolean(step))
      : steps;
    const startedAtMs =
      typeof row.startedAtMs === "number" && row.startedAtMs > 0
        ? row.startedAtMs
        : Date.now();
    let completedAtMs =
      typeof row.completedAtMs === "number" ? row.completedAtMs : undefined;
    const MAX_MS = 2 * 60 * 60 * 1000;
    if (
      typeof completedAtMs === "number" &&
      completedAtMs - startedAtMs > MAX_MS
    ) {
      completedAtMs = startedAtMs;
    }
    return {
      steps: source,
      complete: typeof row.complete === "boolean" ? row.complete : undefined,
      startedAtMs,
      ...(completedAtMs ? { completedAtMs } : {}),
    };
  }
  // Legacy single-frame shape: { id, segments[], complete, ... }.
  if (Array.isArray(row.segments)) {
    const trace = sanitizeAgentTrace({
      steps: row.segments,
      complete: row.complete,
      startedAtMs: row.startedAtMs,
      completedAtMs: row.completedAtMs,
    });
    return trace;
  }
  return null;
}

export function sanitizeBranchMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];

  const out: Message[] = [];
  for (const raw of input.slice(0, MAX_BRANCH_MESSAGES)) {
    const row = asRecord(raw);
    if (!row) continue;
    const role = asString(row.role);
    if (role !== "user" && role !== "assistant") continue;
    const id = asString(row.id);
    if (!id) continue;
    const content = asString(row.content) ?? "";
    const message: Message = {
      id,
      role,
      content,
    };
    const thinkingContent = asString(row.thinkingContent);
    if (thinkingContent) message.thinkingContent = thinkingContent;
    if (typeof row.hasThinking === "boolean") {
      message.hasThinking = row.hasThinking;
    }
    if (typeof row.thinkingDurationSeconds === "number") {
      message.thinkingDurationSeconds = row.thinkingDurationSeconds;
    }
    if (typeof row.agentMode === "boolean") message.agentMode = row.agentMode;
    if (typeof row.agentFrameComplete === "boolean") {
      message.agentFrameComplete = row.agentFrameComplete;
    }
    if (row.agentTrace !== undefined) {
      const trace = sanitizeAgentTrace(row.agentTrace);
      if (trace) message.agentTrace = trace;
    } else if (Array.isArray(row.agentSegments)) {
      // Legacy persisted segments → one complete trace.
      const trace = sanitizeAgentTrace({
        steps: row.agentSegments,
        complete: true,
      });
      if (trace) message.agentTrace = trace;
    } else if (Array.isArray(row.agentFrames)) {
      // Legacy frames → merge segments in order.
      const mergedSteps: unknown[] = [];
      for (const frame of row.agentFrames) {
        const record = asRecord(frame);
        if (record && Array.isArray(record.segments)) {
          mergedSteps.push(...record.segments);
        }
      }
      const trace = sanitizeAgentTrace({ steps: mergedSteps, complete: true });
      if (trace) message.agentTrace = trace;
    }
    if (Array.isArray(row.agentArtifacts)) {
      message.agentArtifacts = row.agentArtifacts
        .map((artifact): ChatArtifact | null => {
          const item = asRecord(artifact);
          if (!item) return null;
          const artifactId = asString(item.id);
          const path = asString(item.path);
          if (!artifactId || !path) return null;
          return {
            id: artifactId,
            path,
            fileName: asString(item.fileName) ?? path.split("/").pop() ?? path,
            content: asString(item.content, MAX_CONTENT_CHARS) ?? "",
            language: asString(item.language),
            description: asString(item.description),
            fileId: asString(item.fileId),
            storagePath: asString(item.storagePath),
            mimeType: asString(item.mimeType),
            sizeBytes:
              typeof item.sizeBytes === "number" ? item.sizeBytes : undefined,
            createdAtMs:
              typeof item.createdAtMs === "number"
                ? item.createdAtMs
                : Date.now(),
          };
        })
        .filter((artifact): artifact is ChatArtifact => Boolean(artifact));
    }
    if (typeof row.createdAt === "number") message.createdAt = row.createdAt;
    out.push(message);
  }
  return out;
}
