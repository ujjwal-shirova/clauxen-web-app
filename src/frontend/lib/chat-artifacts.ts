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

export function collectChatArtifacts(messages: Message[]): ChatArtifact[] {
  const byId = new Map<string, ChatArtifact>();
  for (const message of messages) {
    for (const artifact of message.agentArtifacts ?? []) {
      byId.set(artifact.id, artifact);
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
