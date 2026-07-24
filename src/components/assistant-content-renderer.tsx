"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import type { ChatSource } from "@/lib/chat-sources";
import type { ChatArtifact } from "@/lib/chat-artifacts";
import {
  collectCreateFileArtifacts,
  parseAssistantContentSegments,
  artifactSupportsPreview,
} from "@/lib/create-file-tags";
import { parseTitledTableSegments } from "@/lib/table-title-tags";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TitledMarkdownTable } from "@/components/titled-markdown-table";
import { CreateFileStreamBlock } from "@/components/agent/create-file-stream-block";
import { ArtifactFileCard } from "@/components/agent/artifact-file-card";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";

/** Renders one markdown chunk, splitting out any `<table_title>`-tagged tables. */
function MarkdownWithTitledTables({
  content,
  isStreaming,
  streamKey,
  detailLevel,
  sources,
}: {
  content: string;
  isStreaming: boolean;
  streamKey: string;
  detailLevel: MessageDetailLevel;
  sources: ChatSource[];
}) {
  if (!content.includes("<table_title")) {
    return (
      <MarkdownRenderer
        content={content}
        isStreaming={isStreaming}
        streamKey={streamKey}
        detailLevel={detailLevel}
        {...({ sources } as any)}
      />
    );
  }

  const tableSegments = parseTitledTableSegments(content);
  return (
    <>
      {tableSegments.map((segment, index) => {
        const isLast = index === tableSegments.length - 1;
        if (segment.type === "markdown") {
          if (!segment.content.trim()) return null;
          return (
            <MarkdownRenderer
              key={`${streamKey}-md-${index}`}
              content={segment.content}
              isStreaming={isStreaming && isLast}
              streamKey={`${streamKey}-${index}`}
              detailLevel={detailLevel}
              {...({ sources } as any)}
            />
          );
        }
        return (
          <TitledMarkdownTable
            key={`${streamKey}-${segment.id}`}
            title={segment.title}
            tableMarkdown={segment.tableMarkdown}
            isStreaming={isStreaming && isLast}
            streamKey={`${streamKey}-${index}`}
            sources={sources}
          />
        );
      })}
    </>
  );
}

export function AssistantContentRenderer({
  content,
  messageId,
  isStreaming = false,
  streamKey,
  detailLevel = "full",
  sources = [],
  agentArtifacts = [],
}: {
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  streamKey?: string;
  detailLevel?: MessageDetailLevel;
  sources?: ChatSource[];
  agentArtifacts?: ChatArtifact[];
}) {
  const viewer = useOptionalArtifactViewer();
  const prevCompleteCountRef = useRef(0);
  const resolvedKey = streamKey ?? messageId ?? "assistant";

  const segments = useMemo(
    () => parseAssistantContentSegments(content),
    [content],
  );

  const completedFromTags = useMemo(
    () =>
      messageId ? collectCreateFileArtifacts(content, messageId) : [],
    [content, messageId],
  );

  const completedArtifacts = useMemo(() => {
    const map = new Map<string, ChatArtifact>();
    for (const artifact of agentArtifacts) {
      map.set(artifact.id, artifact);
    }
    for (const artifact of completedFromTags) {
      map.set(artifact.id, artifact);
    }
    return [...map.values()];
  }, [agentArtifacts, completedFromTags]);

  useEffect(() => {
    if (!viewer || !messageId || !isStreaming) return;

    const completeCount = segments.filter(
      (segment) =>
        segment.type === "create_file" && segment.block.isComplete,
    ).length;

    if (completeCount <= prevCompleteCountRef.current) return;

    const latestComplete = [...segments]
      .reverse()
      .find(
        (segment) =>
          segment.type === "create_file" && segment.block.isComplete,
      );

    if (latestComplete?.type === "create_file") {
      const artifactId = `${messageId}:${latestComplete.block.id}`;
      const artifact = completedArtifacts.find((row) => row.id === artifactId);
      if (artifact) {
        const mode = artifactSupportsPreview(artifact.path, artifact.language)
          ? "preview"
          : "code";
        viewer.openArtifact(artifact, mode);
      }
    }

    prevCompleteCountRef.current = completeCount;
  }, [segments, completedArtifacts, viewer, messageId, isStreaming]);

  const hasCreateFileTags = segments.some(
    (segment) => segment.type === "create_file",
  );

  if (!hasCreateFileTags) {
    return (
      <MarkdownWithTitledTables
        content={content}
        isStreaming={isStreaming}
        streamKey={resolvedKey}
        detailLevel={detailLevel}
        sources={sources}
      />
    );
  }

  return (
    <div className="min-w-0 w-full">
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          if (!segment.content.trim()) return null;
          return (
            <MarkdownWithTitledTables
              key={`md-${index}`}
              content={segment.content}
              isStreaming={isStreaming && index === segments.length - 1}
              streamKey={`${resolvedKey}-${index}`}
              detailLevel={detailLevel}
              sources={sources}
            />
          );
        }

        if (!segment.block.isComplete) {
          return (
            <CreateFileStreamBlock
              key={`create-stream-${segment.block.id}`}
              block={segment.block}
              streamKey={resolvedKey}
            />
          );
        }

        return null;
      })}

      {completedFromTags.length > 0 ? (
        <div className="mt-1 flex w-full flex-col gap-2">
          {completedFromTags.map((artifact) => (
            <ArtifactFileCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
