import type { Message } from "@/frontend/lib/types";
import { collectCreateFileArtifacts } from "@/frontend/lib/create-file-tags";
import { downloadTextFile } from "@/frontend/lib/download-file";

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

/**
 * Rebuild downloadable cards from present_files tool results so reload
 * restores the same presentation as the live SSE artifact_upsert path.
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
  const byId = new Map<string, ChatArtifact>();

  for (const segment of segments) {
    if (segment.kind !== "tool" || segment.name !== "present_files") continue;

    const stamp = segment.completedAtMs ?? Date.now();
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
        // fall through to args / enriched fields
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
      const id = `${messageId}:present:${segment.toolCallId ?? segment.id}:${index}`;
      byId.set(id, {
        id,
        path: file.path,
        fileName: fileNameFromPath(file.path),
        content: file.content,
        language: segment.fileLanguage,
        createdAtMs: stamp,
      });
    });
  }

  return [...byId.values()];
}

export function collectChatArtifacts(messages: Message[]): ChatArtifact[] {
  const byId = new Map<string, ChatArtifact>();
  for (const message of messages) {
    for (const artifact of message.agentArtifacts ?? []) {
      byId.set(artifact.id, artifact);
    }
    if (message.agentSegments) {
      for (const artifact of collectArtifactsFromAgentSegments(
        message.id,
        message.agentSegments,
      )) {
        byId.set(artifact.id, artifact);
      }
    }
    for (const frame of message.agentFrames ?? []) {
      for (const artifact of collectArtifactsFromAgentSegments(
        message.id,
        frame.segments,
      )) {
        byId.set(artifact.id, artifact);
      }
    }
    if (message.role === "assistant" && message.content.includes("<create_file")) {
      for (const artifact of collectCreateFileArtifacts(
        message.content,
        message.id,
      )) {
        byId.set(artifact.id, artifact);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
}
