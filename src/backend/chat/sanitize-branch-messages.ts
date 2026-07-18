import type { Message } from "@/frontend/lib/types";
import type { AgentFrame } from "@/frontend/lib/agent-frames";
import type {
  AgentSegment,
  WebSearchResult,
} from "@/frontend/lib/agent-segments";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";

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

function sanitizeAgentSegment(value: unknown): AgentSegment | null {
  const row = asRecord(value);
  if (!row) return null;
  const kind = asString(row.kind);
  const id = asString(row.id) ?? `seg-${Math.random().toString(36).slice(2, 10)}`;
  if (kind === "thinking") {
    return {
      kind: "thinking",
      id,
      heading: asString(row.heading, 80),
      content: asString(row.content) ?? "",
      isStreaming: Boolean(row.isStreaming),
      durationSeconds:
        typeof row.durationSeconds === "number" ? row.durationSeconds : undefined,
      startedAtMs:
        typeof row.startedAtMs === "number" ? row.startedAtMs : undefined,
    };
  }
  if (kind === "narration" || kind === "text") {
    return {
      kind,
      id,
      content: asString(row.content) ?? "",
      isStreaming: Boolean(row.isStreaming),
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
          .filter((item): item is WebSearchResult => item !== null) as WebSearchResult[])
      : undefined;
    return {
      kind: "tool",
      id,
      toolCallId: asString(row.toolCallId) ?? id,
      name: asString(row.name) ?? "tool",
      status:
        row.status === "running" || row.status === "error" ? row.status : "done",
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
  if (kind === "step_done") {
    return {
      kind: "step_done",
      id,
      label: asString(row.label),
    };
  }
  return null;
}

function sanitizeAgentFrame(value: unknown): AgentFrame | null {
  const row = asRecord(value);
  if (!row) return null;
  const segments = Array.isArray(row.segments)
    ? row.segments
        .map(sanitizeAgentSegment)
        .filter((segment): segment is AgentSegment => Boolean(segment))
    : [];
  const startedAtMs =
    typeof row.startedAtMs === "number" && row.startedAtMs > 0
      ? row.startedAtMs
      : Date.now();
  let completedAtMs =
    typeof row.completedAtMs === "number" ? row.completedAtMs : undefined;
  // Clamp absurd spans (stale startedAt + missing/wrong completedAt).
  const MAX_MS = 2 * 60 * 60 * 1000;
  if (
    typeof completedAtMs === "number" &&
    completedAtMs - startedAtMs > MAX_MS
  ) {
    completedAtMs = startedAtMs;
  }
  if (row.complete && completedAtMs == null) {
    completedAtMs = startedAtMs;
  }
  return {
    id: asString(row.id) ?? `frame-${Math.random().toString(36).slice(2, 10)}`,
    segments,
    complete: Boolean(row.complete),
    startedAtMs,
    completedAtMs,
    introNarrative: asString(row.introNarrative),
    interimOutput: asString(row.interimOutput),
  };
}

/**
 * Persist branch UI state without stripping message ids / agent frames.
 * (sanitizeMessages is for model prompts only — it drops ids and caused
 * reload duplicates when every message collapsed onto `undefined`.)
 */
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
    if (Array.isArray(row.agentSegments)) {
      message.agentSegments = row.agentSegments
        .map(sanitizeAgentSegment)
        .filter((segment): segment is AgentSegment => Boolean(segment));
    }
    if (Array.isArray(row.agentFrames)) {
      message.agentFrames = row.agentFrames
        .map(sanitizeAgentFrame)
        .filter((frame): frame is AgentFrame => Boolean(frame));
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
