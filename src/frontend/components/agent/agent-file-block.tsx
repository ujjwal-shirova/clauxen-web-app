"use client";

import { FileText } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";
import { AgentToolCard } from "./agent-tool-card";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * create_file / file_write: while running → stream container;
 * when done → collapsed file chip only (compact row, no timeline chrome).
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
      : tool.description;
  const showStream = isRunning;

  // Done → compact collapsed chip only (no stream preview / chrome).
  if (!isRunning) {
    return (
      <div className="mb-1">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-zinc-200 bg-background px-2.5 py-1 text-[12px] font-medium text-zinc-600">
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{fileName || "file"}</span>
        </span>
      </div>
    );
  }

  return (
    <AgentToolCard
      variant="file"
      label={description || `Creating ${fileName}`}
      isRunning
    >
      {fileName ? (
        <span className="mb-1 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-zinc-200 bg-background px-2.5 py-1 text-[12px] font-medium text-zinc-600">
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{fileName}</span>
        </span>
      ) : null}
      {showStream ? (
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
      ) : null}
    </AgentToolCard>
  );
}

export function PresentFilesBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const paths = Array.isArray(tool.args?.paths)
    ? tool.args.paths.filter((p): p is string => typeof p === "string")
    : tool.filePath
      ? [tool.filePath]
      : [];
  const count = paths.length;
  const plural = count !== 1 ? "s" : "";

  return (
    <AgentToolCard
      variant="file"
      label={
        isRunning
          ? `Presenting file${plural}`
          : `Presented ${count || ""} file${plural}`.trim()
      }
      isRunning={isRunning}
    />
  );
}
