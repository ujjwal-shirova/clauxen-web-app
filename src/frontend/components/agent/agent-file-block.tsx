"use client";

import { Download, FileCode } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import {
  downloadArtifact,
  fileNameFromPath,
  languageLabel,
} from "@/frontend/lib/chat-artifacts";
import { AgentTimelineStep } from "./agent-timeline";

export function AgentFileBlock({ tool }: { tool: AgentToolSegment }) {
  const path =
    tool.filePath ??
    (typeof tool.args?.path === "string" ? tool.args.path : "");
  const fileName = path ? fileNameFromPath(path) : tool.name;
  const content =
    tool.fileContent ??
    (typeof tool.args?.file_text === "string" ? tool.args.file_text : "");
  const language =
    tool.fileLanguage ??
    (typeof tool.args?.language === "string" ? tool.args.language : undefined);
  const isRunning = tool.status === "running";

  const handleDownload = () => {
    if (!path || !content) return;
    downloadArtifact({
      id: path,
      path,
      fileName,
      content,
      language,
      createdAtMs: Date.now(),
    });
  };

  return (
    <AgentTimelineStep
      icon="file"
      isActive={isRunning}
      title={
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <span
            className={cn(
              "truncate font-medium text-zinc-800",
              isRunning && "shimmer-text",
            )}
          >
            {fileName}
          </span>
          {content ? (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={`Download ${fileName}`}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          ) : null}
        </div>
      }
      trailing={
        isRunning ? (
          <span className="text-[12px] text-zinc-400">Writing…</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-zinc-400">
            <FileCode className="h-3.5 w-3.5" />
            {languageLabel(language)}
          </span>
        )
      }
    >
      {content ? (
        <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <span className="truncate text-[12px] font-mono text-zinc-500">
              {path}
            </span>
          </div>
          <pre
            className={cn(
              "max-h-48 overflow-auto whitespace-pre-wrap break-all px-3 py-2.5 font-mono text-[12px] leading-5 text-zinc-700",
            )}
          >
            {content.slice(0, 4000)}
            {content.length > 4000 ? "\n…" : ""}
          </pre>
        </div>
      ) : isRunning ? (
        <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[13px] text-zinc-500">
          Creating file…
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}
