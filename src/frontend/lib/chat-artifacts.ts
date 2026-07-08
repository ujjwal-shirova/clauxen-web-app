import type { Message } from "@/frontend/lib/types";
import { collectCreateFileArtifacts } from "@/frontend/lib/create-file-tags";

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
  const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
