"use client";

import { FileText } from "lucide-react";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";
import { countContentLineDiff } from "@/frontend/lib/agent-fold-groups";
import { cn } from "@/frontend/lib/utils";
import { AgentToolCard } from "./agent-tool-card";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * create_file / file_write — streaming write UI + compact file pill with
 * +N/−M line stats. Does NOT present a downloadable artifact; that is owned
 * by present_files (via SSE artifact_upsert → message.agentArtifacts).
 */
export function AgentFileBlock({
  tool,
  previousContent,
}: {
  tool: AgentToolSegment;
  /** Prior content for the same path (rewrite) so −M is meaningful. */
  previousContent?: string;
}) {
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

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5" data-agent-file-block>
      <AgentToolCard
        label={
          isRunning
            ? description || `Creating ${fileName || "file"}`
            : `Created ${fileName || "file"}`
        }
        trailing={
          showDiff ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              {diff.insertions > 0 ? (
                <span className="text-emerald-600">+{diff.insertions}</span>
              ) : null}
              {diff.deletions > 0 ? (
                <span className="text-rose-500">−{diff.deletions}</span>
              ) : null}
            </span>
          ) : undefined
        }
        isRunning={isRunning}
        defaultExpanded
      >
        {isRunning || content ? (
          <CreateFileStreamBlock
            compact
            block={{
              id: path || tool.id,
              path: path || fileName,
              title: fileName.replace(/\.[^.]+$/, "") || "Untitled",
              language,
              content,
              isComplete: !isRunning,
            }}
            streamKey={tool.id}
          />
        ) : null}
      </AgentToolCard>

      {!isRunning && fileName ? (
        <div
          className={cn(
            "inline-flex max-w-full items-center gap-2 self-start rounded-xl border border-zinc-200/90 bg-white px-2.5 py-1.5",
            "shadow-[0_1px_2px_rgba(24,24,27,0.03)]",
          )}
          data-agent-file-pill
        >
          <FileText
            className="h-3.5 w-3.5 shrink-0 text-zinc-500"
            strokeWidth={1.7}
            aria-hidden
          />
          <span className="min-w-0 truncate text-[13px] font-[430] tracking-[-0.01em] text-zinc-800">
            {fileName}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * present_files — status line for the present step.
 * Downloadable cards are rendered from message.agentArtifacts once the
 * tool emits artifact_upsert (not from create_file).
 */
export function PresentFilesBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const paths = Array.isArray(tool.args?.paths)
    ? tool.args.paths.filter((p): p is string => typeof p === "string")
    : tool.filePath
      ? [tool.filePath]
      : [];
  const count = paths.length || (tool.filePath ? 1 : 0);
  const plural = count !== 1 ? "s" : "";
  const singleName =
    count === 1 ? fileNameFromPath(paths[0] ?? tool.filePath ?? "") : undefined;

  return (
    <AgentToolCard
      label={
        isRunning
          ? `Presenting file${plural}`
          : singleName
            ? `Presented ${singleName}`
            : count > 0
              ? `Presented ${count} file${plural}`
              : "Presented files"
      }
      isRunning={isRunning}
      defaultExpanded={false}
    />
  );
}
