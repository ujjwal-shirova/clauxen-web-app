"use client";

import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import { fileNameFromPath } from "@/frontend/lib/chat-artifacts";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";
import { AgentToolCard } from "./agent-tool-card";
import { CreateFileStreamBlock } from "./create-file-stream-block";

/**
 * create_file / file_write — streaming write UI only.
 * Does NOT present a downloadable artifact; that is owned by present_files
 * (via SSE artifact_upsert → message.agentArtifacts).
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

  return (
    <AgentToolCard
      label={
        isRunning
          ? description || `Creating ${fileName || "file"}`
          : `Created ${fileName || "file"}`
      }
      isRunning={isRunning}
      defaultExpanded={false}
    >
      {isRunning ? (
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
