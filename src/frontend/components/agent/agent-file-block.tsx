"use client";

import { FileText } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";
import { AgentTimelineStep } from "./agent-timeline";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * file_write is a scratch write — it does not show a downloadable card by
 * itself (that only happens once present_files is called; see
 * PresentFilesBlock + the artifact cards rendered at the end of the message
 * in agent-orchestration.tsx). While running/just-finished this just shows a
 * lightweight "wrote this file" chip, matching the reference agent UI.
 */
export function AgentFileBlock({ tool }: { tool: AgentToolSegment }) {
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
      : undefined;

  return (
    <AgentTimelineStep
      icon="file"
      isActive={isRunning}
      title={
        <span
          className={cn(
            "truncate font-medium text-zinc-800",
            isRunning && "shimmer-text",
          )}
        >
          {description || `Creating ${fileName}`}
        </span>
      }
    >
      {isRunning ? (
        <CreateFileStreamBlock
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
      ) : fileName ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-zinc-600">
          <FileText className="h-3.5 w-3.5 text-zinc-400" />
          {fileName}
        </span>
      ) : null}
    </AgentTimelineStep>
  );
}

export function PresentFilesBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const count = Array.isArray(tool.args?.paths) ? tool.args.paths.length : 0;
  const plural = count > 1 ? "s" : "";

  return (
    <AgentTimelineStep
      icon="file"
      isActive={isRunning}
      title={
        <span className={cn(isRunning && "shimmer-text")}>
          {isRunning ? `Presenting file${plural}` : `Presented file${plural}`}
        </span>
      }
    />
  );
}
