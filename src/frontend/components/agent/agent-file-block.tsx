"use client";

import { cn } from "@/frontend/lib/utils";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import {
  fileNameFromPath,
  languageLabel,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";
import { AgentTimelineStep } from "./agent-timeline";
import { CreateFileStreamBlock } from "./create-file-stream-block";
import { ArtifactFileCard } from "./artifact-file-card";

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

  const artifact: ChatArtifact | null =
    path && content
      ? {
          id: path,
          path,
          fileName,
          content,
          language,
          description,
          createdAtMs: tool.completedAtMs ?? Date.now(),
        }
      : null;

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
      trailing={
        isRunning ? (
          <span className="text-[12px] text-zinc-400">Writing…</span>
        ) : (
          <span className="text-[12px] text-zinc-400">
            {languageLabel(language)}
          </span>
        )
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
      ) : artifact ? (
        <ArtifactFileCard artifact={artifact} />
      ) : (
        <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[13px] text-zinc-500">
          Creating file…
        </div>
      )}
    </AgentTimelineStep>
  );
}
