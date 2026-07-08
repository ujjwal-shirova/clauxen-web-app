"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import type { ChatSource } from "@/frontend/lib/chat-sources";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";
import {
  collectCreateFileArtifacts,
  parseAssistantContentSegments,
} from "@/frontend/lib/create-file-tags";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { CreateFileStreamBlock } from "@/frontend/components/agent/create-file-stream-block";
import { ArtifactFileCard } from "@/frontend/components/agent/artifact-file-card";
import { useOptionalArtifactViewer } from "@/frontend/contexts/artifact-viewer-context";

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
        viewer.openArtifact(artifact, "preview");
      }
    }

    prevCompleteCountRef.current = completeCount;
  }, [segments, completedArtifacts, viewer, messageId, isStreaming]);

  const hasCreateFileTags = segments.some(
    (segment) => segment.type === "create_file",
  );

  if (!hasCreateFileTags) {
    return (
      <MarkdownRenderer
        content={content}
        isStreaming={isStreaming}
        streamKey={resolvedKey}
        detailLevel={detailLevel}
        {...({ sources } as any)}
      />
    );
  }

  return (
    <div className="min-w-0 w-full">
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          if (!segment.content.trim()) return null;
          return (
            <MarkdownRenderer
              key={`md-${index}`}
              content={segment.content}
              isStreaming={isStreaming && index === segments.length - 1}
              streamKey={`${resolvedKey}-${index}`}
              detailLevel={detailLevel}
              {...({ sources } as any)}
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
