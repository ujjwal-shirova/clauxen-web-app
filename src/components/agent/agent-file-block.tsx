"use client";

import type { AgentToolSegment } from "@/lib/agent-segments";
import { fileNameFromPath, type ChatArtifact } from "@/lib/chat-artifacts";
import {
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import { countContentLineDiff } from "@/lib/agent-activity-summary";
import { cn } from "@/lib/utils";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";
import { AgentToolCard } from "./agent-tool-card";
import { AgentShimmerText } from "./agent-trace";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * create_file / file_write — Cursor-style timeline row when done:
 * "Edited filename +N −M" (click opens the file viewer).
 * While writing: expanded live stream under a shimmering header.
 */
export function AgentFileBlock({
  tool,
  previousContent,
}: {
  tool: AgentToolSegment;
  previousContent?: string;
}) {
  const viewer = useOptionalArtifactViewer();
  const path =
    tool.filePath ??
    (typeof tool.args?.path === "string" ? tool.args.path : "");
  const fileName = path ? fileNameFromPath(path) : tool.name;
  const content =
    tool.fileContent ??
    (typeof tool.args?.file_text === "string"
      ? tool.args.file_text
      : typeof tool.args?.content === "string"
        ? tool.args.content
        : "");
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
  const diff = countContentLineDiff(content, previousContent);
  const showDiff = !isRunning && (diff.insertions > 0 || diff.deletions > 0);
  const isEdit = Boolean(previousContent && previousContent.length > 0);
  const verb = isEdit ? "Edited" : "Created";

  if (isRunning) {
    return (
      <div
        className="flex w-full min-w-0 flex-col"
        data-agent-file-block="writing"
      >
        <AgentToolCard
          label={
            <AgentShimmerText active>
              <span className="agent-activity-label--muted">
                {description || `Writing ${fileName || "file"}`}
              </span>
              <span className="agent-activity-label--subtle">…</span>
            </AgentShimmerText>
          }
          isRunning
          defaultExpanded
        >
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
        </AgentToolCard>
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
    createdAtMs: tool.completedAtMs ?? Date.now(),
  };

  const openFile = () => {
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
      disabled={!content}
      className={cn(
        "group/file-row no-hover-overlay inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[13px] font-[430] leading-5 tracking-[-0.01em] shadow-none",
        "hover:bg-transparent focus-visible:outline-none focus-visible:ring-0",
        !content && "cursor-default opacity-70",
      )}
      data-agent-file-block="done"
      aria-label={content ? `Open ${fileName}` : fileName}
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
export function PresentFilesBlock(_props: { tool: AgentToolSegment }) {
  return null;
}
