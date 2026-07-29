"use client";

import { FileText } from "lucide-react";
import type { AgentToolSegment } from "@/lib/agent-segments";
import { fileNameFromPath, type ChatArtifact } from "@/lib/chat-artifacts";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import { countContentLineDiff } from "@/lib/agent-work-groups";
import { cn } from "@/lib/utils";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";
import { AgentToolCard } from "./agent-tool-card";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * create_file / file_write
 * - While writing: expanded live stream
 * - When done: only a clickable collapsed chip (opens the file viewer).
 * create_file auto-presents — no present_files step.
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

  if (isRunning) {
    return (
      <div
        className="flex w-full min-w-0 flex-col"
        data-agent-file-block="writing"
      >
        <AgentToolCard
          label={description || `Creating ${fileName || "file"}`}
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

  const title =
    artifact.description || artifact.fileName.replace(/\.[^.]+$/, "");
  const meta = artifactMetaLabel(artifact.path, language || "text");

  return (
    <button
      type="button"
      onClick={openFile}
      disabled={!content}
      className={cn(
        "group/file-chip no-hover-overlay flex w-full max-w-md items-center gap-2.5 rounded-[12px] border border-zinc-200/90 bg-zinc-50/90 px-2.5 py-2 text-left transition-colors duration-150",
        "hover:border-zinc-300 hover:bg-zinc-100/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200/90",
        !content && "cursor-default opacity-70",
      )}
      data-agent-file-block="done"
      aria-label={content ? `Open ${title}` : title}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-zinc-200/90 bg-white">
        <FileText
          className="h-[18px] w-[18px] text-zinc-500"
          strokeWidth={1.6}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-zinc-900">
          {fileName}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[12px] font-[430] text-zinc-500">
          <span className="truncate">{meta}</span>
          {showDiff ? (
            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
              {diff.insertions > 0 ? (
                <span className="text-emerald-600">+{diff.insertions}</span>
              ) : null}
              {diff.deletions > 0 ? (
                <span className="text-rose-500">−{diff.deletions}</span>
              ) : null}
            </span>
          ) : null}
        </p>
      </div>
    </button>
  );
}

/** present_files is removed from the agent loop — hide legacy hydrated steps. */
export function PresentFilesBlock(_props: { tool: AgentToolSegment }) {
  return null;
}
