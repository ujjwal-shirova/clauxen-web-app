import type { Message } from "@/lib/types";
import { collectCreateFileArtifacts } from "@/lib/create-file-tags";
import { downloadTextFile } from "@/lib/download-file";

export type ChatArtifact = {
  id: string;
  path: string;
  fileName: string;
  content: string;
  language?: string;
  description?: string;
  createdAtMs: number;
};

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function languageLabel(language?: string): string {
  if (!language || language === "text") return "Text";
  return language.replace(/^\w/, (c) => c.toUpperCase());
}

export function downloadArtifact(artifact: ChatArtifact) {
  downloadTextFile(artifact.fileName, artifact.content);
}

function normalizeArtifactPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").trim().toLowerCase();
}

/** Prefer richer / newer artifact when the same path appears twice. */
function preferArtifact(a: ChatArtifact, b: ChatArtifact): ChatArtifact {
  if (b.content.length !== a.content.length) {
    return b.content.length > a.content.length ? b : a;
  }
  return b.createdAtMs >= a.createdAtMs ? b : a;
}

/**
 * Rebuild downloadable cards from create_file (and legacy present_files)
 * tool results so reload restores the same presentation as live SSE.
 */
export function collectArtifactsFromAgentSegments(
  messageId: string,
  segments: Array<{
    kind: string;
    id?: string;
    toolCallId?: string;
    name?: string;
    result?: string;
    args?: Record<string, unknown>;
    filePath?: string;
    fileContent?: string;
    fileLanguage?: string;
    completedAtMs?: number;
  }>,
): ChatArtifact[] {
  const byPath = new Map<string, ChatArtifact>();

  for (const segment of segments) {
    if (segment.kind !== "tool") continue;

    const stamp = segment.completedAtMs ?? Date.now();

    if (segment.name === "create_file" || segment.name === "file_write") {
      let path =
        segment.filePath ??
        (typeof segment.args?.path === "string" ? segment.args.path : "");
      let content =
        segment.fileContent ??
        (typeof segment.args?.content === "string"
          ? segment.args.content
          : typeof segment.args?.file_text === "string"
            ? segment.args.file_text
            : "");
      if (segment.result?.trim()) {
        try {
          const parsed = JSON.parse(segment.result) as {
            path?: string;
            content?: string;
          };
          if (typeof parsed.path === "string" && parsed.path) path = parsed.path;
          if (typeof parsed.content === "string" && parsed.content) {
            content = parsed.content;
          }
        } catch {
          // keep args / enriched fields
        }
      }
      if (!path || !content) continue;
      const key = normalizeArtifactPath(path);
      const next: ChatArtifact = {
        id: `${messageId}:create:${segment.toolCallId ?? segment.id}`,
        path,
        fileName: fileNameFromPath(path),
        content,
        language: segment.fileLanguage,
        createdAtMs: stamp,
      };
      const existing = byPath.get(key);
      byPath.set(key, existing ? preferArtifact(existing, next) : next);
      continue;
    }

    if (segment.name !== "present_files") continue;

    let files: Array<{ path: string; content: string }> = [];

    if (segment.result?.trim()) {
      try {
        const parsed = JSON.parse(segment.result) as {
          files?: Array<{ path?: string; content?: string }>;
        };
        if (Array.isArray(parsed.files)) {
          files = parsed.files.filter(
            (file): file is { path: string; content: string } =>
              typeof file?.path === "string" && typeof file?.content === "string",
          );
        }
      } catch {
        // fall through
      }
    }

    if (files.length === 0) {
      const paths = Array.isArray(segment.args?.paths)
        ? segment.args.paths.filter((p): p is string => typeof p === "string")
        : segment.filePath
          ? [segment.filePath]
          : [];
      for (const path of paths) {
        files.push({
          path,
          content:
            path === segment.filePath && typeof segment.fileContent === "string"
              ? segment.fileContent
              : "",
        });
      }
    }

    files.forEach((file, index) => {
      if (!file.content) return;
      const key = normalizeArtifactPath(file.path);
      const next: ChatArtifact = {
        id: `${messageId}:present:${segment.toolCallId ?? segment.id}:${index}`,
        path: file.path,
        fileName: fileNameFromPath(file.path),
        content: file.content,
        language: segment.fileLanguage,
        createdAtMs: stamp,
      };
      const existing = byPath.get(key);
      byPath.set(key, existing ? preferArtifact(existing, next) : next);
    });
  }

  return [...byPath.values()];
}

export function collectChatArtifacts(messages: Message[]): ChatArtifact[] {
  const byPath = new Map<string, ChatArtifact>();

  const upsert = (artifact: ChatArtifact) => {
    const key = normalizeArtifactPath(artifact.path || artifact.fileName);
    if (!key) return;
    const existing = byPath.get(key);
    byPath.set(key, existing ? preferArtifact(existing, artifact) : artifact);
  };

  for (const message of messages) {
    for (const artifact of message.agentArtifacts ?? []) {
      upsert(artifact);
    }
    if (message.agentSegments) {
      for (const artifact of collectArtifactsFromAgentSegments(
        message.id,
        message.agentSegments,
      )) {
        upsert(artifact);
      }
    }
    for (const frame of message.agentFrames ?? []) {
      for (const artifact of collectArtifactsFromAgentSegments(
        message.id,
        frame.segments,
      )) {
        upsert(artifact);
      }
    }
    if (message.role === "assistant" && message.content.includes("<create_file")) {
      for (const artifact of collectCreateFileArtifacts(
        message.content,
        message.id,
      )) {
        upsert(artifact);
      }
    }
  }
  return [...byPath.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
}
