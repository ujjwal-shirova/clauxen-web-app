"use client";

import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { StreamingMarkdown } from "@/components/streaming-markdown";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import {
  markdownComponents,
  normalizeLatexDelimiters,
  sharedReactMarkdownProps,
} from "@/components/markdown-shared";
import { createCitationLink } from "@/components/chat-sources";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import {
  convertCitationReferencesToLinks,
  stripReferenceDefinitions,
  stripTrailingCitationClusters,
  type ChatSource,
} from "@/lib/chat-sources";

export const MarkdownOrchestrator = ({
  text,
  sources = [],
}: {
  text: string;
  sources?: ChatSource[];
  isTyping?: boolean;
  showCursor?: boolean;
}) => {
  const normalizedText = stripReferenceDefinitions(
    normalizeLatexDelimiters(text),
  );
  let displayText = normalizedText;
  if (sources.length > 0) {
    // Convert model citation syntax ([Title][N] or [N]) into direct links
    // so that our link renderer can replace them with inline SourceChips.
    // Trailing citation-only footers never render as a bottom chip group.
    displayText = convertCitationReferencesToLinks(
      stripTrailingCitationClusters(displayText),
      sources,
    );
  }

  // If we have sources, override the link renderer to turn citation links into inline chips
  const effectiveComponents =
    sources.length > 0
      ? {
          ...markdownComponents,
          a: createCitationLink(sources),
        }
      : markdownComponents;

  return (
    <div className="markdown-content relative min-w-0 max-w-full">
      <ReactMarkdown
        {...sharedReactMarkdownProps}
        components={effectiveComponents}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownMessage = ({
  content,
  onTypingComplete,
  isStreaming,
  streamKey,
  showCursor = false,
  lightweightStream = false,
  detailLevel = "full",
  sources = [],
}: {
  content: string;
  onTypingComplete?: () => void;
  isStreaming?: boolean;
  streamKey?: string;
  showCursor?: boolean;
  /** Plain pre-wrap during stream (no markdown) — used for thinking panel. */
  lightweightStream?: boolean;
  /** LOD: plain/placeholder strips heavy syntax highlighting off-screen. */
  detailLevel?: MessageDetailLevel;
  /** Sources for this message (web search). Used to render inline citation chips and clean refs. */
  sources?: ChatSource[];
}) => {
  useEffect(() => {
    if (!isStreaming && onTypingComplete) {
      onTypingComplete();
    }
  }, [isStreaming, onTypingComplete]);

  if (detailLevel === "placeholder") {
    return (
      <div className="min-h-[48px] whitespace-pre-wrap break-words text-[16px] leading-[25px] text-zinc-600">
        {content.slice(0, 280)}
        {content.length > 280 ? "…" : ""}
      </div>
    );
  }

  if (detailLevel === "plain" && !isStreaming) {
    return (
      <div className="whitespace-pre-wrap break-words text-[16px] leading-[25px] text-zinc-800">
        {content}
      </div>
    );
  }

  if (isStreaming && lightweightStream) {
    return (
      <div className="relative min-w-0 max-w-full" data-streaming>
        <StreamingTextFade content={content} streamKey={streamKey} />
        {showCursor ? (
          <StreamingOrbCursor className="ml-1 translate-y-[-1px]" />
        ) : null}
      </div>
    );
  }

  // Convert citations once inside StreamingMarkdown — pre-converting here
  // rewrote the whole answer when sources landed and fought the token paint.
  const cleanContent = stripReferenceDefinitions(content);
  const displayContent =
    sources.length > 0
      ? stripTrailingCitationClusters(cleanContent)
      : cleanContent;

  return (
    <div
      className="relative min-w-0 max-w-full overflow-anchor-none"
      data-streaming={isStreaming || undefined}
    >
      <StreamingMarkdown
        content={displayContent}
        isStreaming={isStreaming}
        streamKey={streamKey}
        sources={sources}
      />
      {isStreaming && showCursor ? (
        <StreamingOrbCursor className="ml-1 inline-block translate-y-[-1px]" />
      ) : null}
    </div>
  );
};

export type MarkdownRendererProps = {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  showCursor?: boolean;
  lightweightStream?: boolean;
  detailLevel?: MessageDetailLevel;
  sources?: ChatSource[];
};

export const MarkdownRenderer = ({
  content,
  isStreaming = false,
  streamKey,
  showCursor = false,
  lightweightStream = false,
  detailLevel = "full",
  sources = [],
}: MarkdownRendererProps) => (
  <MarkdownMessage
    content={content}
    isStreaming={isStreaming}
    streamKey={streamKey}
    showCursor={showCursor}
    lightweightStream={lightweightStream}
    detailLevel={detailLevel}
    sources={sources}
  />
);
