"use client";

import type { AgentToolStep } from "@/lib/agent-trace";
import {
  downloadArtifact,
  fileNameFromPath,
  type ChatArtifact,
} from "@/lib/chat-artifacts";
import {
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import { cn } from "@/lib/utils";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";
import { CreateFileStreamBlock } from "./create-file-stream-block";

function countFileLines(
  content: string,
  previousContent?: string,
): { insertions: number; deletions: number } {
  const count = (value: string) =>
    value ? value.replace(/\n$/, "").split("\n").length : 0;
  const next = count(content);
  if (!previousContent) return { insertions: next, deletions: 0 };
  const prev = count(previousContent);
  return {
    insertions: Math.max(0, next - Math.min(next, prev)),
    deletions: Math.max(0, prev - next),
  };
}

/**
 * create_file / file_write — timeline row when done:
 * "Edited filename +N −M" (click opens the file viewer).
 * While writing: expanded live stream under a shimmering header.
 */
export function AgentFileBlock({
  tool,
  previousContent,
}: {
  tool: AgentToolStep;
  previousContent?: string;
}) {
  const viewer = useOptionalArtifactViewer();
  let path =
    tool.filePath ??
    (typeof tool.args?.path === "string" ? tool.args.path : "");
  let content =
    tool.fileContent ??
    (typeof tool.args?.file_text === "string"
      ? tool.args.file_text
      : typeof tool.args?.content === "string"
        ? tool.args.content
        : "");
  let fileId: string | undefined;
  let storagePath: string | undefined;
  let mimeType: string | undefined;
  let sizeBytes: number | undefined;
  if (tool.result?.trim()) {
    try {
      const result = JSON.parse(tool.result) as Record<string, unknown>;
      if (typeof result.path === "string") path = result.path;
      if (typeof result.content === "string") content = result.content;
      if (typeof result.fileId === "string") fileId = result.fileId;
      if (typeof result.storagePath === "string")
        storagePath = result.storagePath;
      if (typeof result.mimeType === "string") mimeType = result.mimeType;
      if (typeof result.sizeBytes === "number") sizeBytes = result.sizeBytes;
    } catch {
      // Streaming arguments remain the source of truth while a result is partial.
    }
  }
  const fileName = path ? fileNameFromPath(path) : tool.name;
  const language =
    tool.fileLanguage ??
    (typeof tool.args?.language === "string"
      ? tool.args.language
      : inferLanguageFromPath(path));
  const isRunning = tool.status === "running";
  const description =
    typeof tool.args?.description === "string"
      ? tool.args.description
      : tool.description;
  const diff = countFileLines(content, previousContent);
  const showDiff = !isRunning && (diff.insertions > 0 || diff.deletions > 0);
  const isEdit = Boolean(previousContent && previousContent.length > 0);
  const verb = isEdit ? "Edited" : "Created";

  if (isRunning) {
    return (
      <div
        className="flex w-full min-w-0 flex-col gap-1"
        data-agent-file-block="writing"
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-[430] leading-5 tracking-[-0.01em]">
          <span className="shimmer-text" data-shimmer-active="true">
            Writing {description || fileName || "file"}…
          </span>
        </div>
        <CreateFileStreamBlock
          compact
          block={{
            id: path || tool.id,
            path: path || fileName,
            title: fileName.replace(/\.[^.]+$/, "") || "Untitled",
            language,
            content,
            isComplete: false,
          }}
          streamKey={tool.id}
        />
      </div>
    );
  }

  if (!fileName && !content) return null;

  const artifact: ChatArtifact = {
    id: tool.toolCallId || tool.id,
    path: path || fileName,
    fileName: fileName || "file",
    content,
    language,
    description: typeof description === "string" ? description : undefined,
    fileId,
    storagePath,
    mimeType,
    sizeBytes,
    createdAtMs: tool.completedAtMs ?? Date.now(),
  };

  const openFile = () => {
    if (!content && fileId) {
      downloadArtifact(artifact);
      return;
    }
    if (!content) return;
    const mode = artifactSupportsPreview(artifact.path, artifact.language)
      ? "preview"
      : "code";
    viewer?.openArtifact(artifact, mode);
  };

  return (
    <button
      type="button"
      onClick={openFile}
      disabled={!content && !fileId}
      className={cn(
        "group/file-row no-hover-overlay inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[13px] font-[430] leading-5 tracking-[-0.01em] shadow-none",
        "hover:bg-transparent focus-visible:outline-none focus-visible:ring-0",
        !content && !fileId && "cursor-default opacity-70",
      )}
      data-agent-file-block="done"
      aria-label={
        content
          ? `Open ${fileName}`
          : fileId
            ? `Download ${fileName}`
            : fileName
      }
    >
      <span className="agent-activity-label--muted shrink-0">{verb}</span>
      <span className="agent-activity-label--subtle min-w-0 truncate">
        {fileName}
      </span>
      {showDiff ? (
        <span className="agent-activity-diff inline-flex shrink-0 items-center gap-1 tabular-nums">
          {diff.insertions > 0 ? (
            <span className="agent-activity-diff--add">+{diff.insertions}</span>
          ) : null}
          {diff.deletions > 0 ? (
            <span className="agent-activity-diff--del">−{diff.deletions}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

/** present_files is removed from the agent loop — hide legacy hydrated steps. */
export function PresentFilesBlock(_props: { tool: AgentToolStep }) {
  return null;
}
