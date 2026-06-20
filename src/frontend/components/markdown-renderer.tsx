"use client";

import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { OrbCursor } from "@/frontend/components/ui/orb-cursor";
import {
  markdownComponents,
  normalizeLatexDelimiters,
  sharedReactMarkdownProps,
} from "@/frontend/components/markdown-shared";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { FlowTokenMarkdown } from "./flowtoken-markdown";
import { SourceChip } from "@/frontend/components/chat-sources";
import {
  convertCitationReferencesToLinks,
  normalizeUrl,
  stripReferenceDefinitions,
  type ChatSource,
} from "@/frontend/lib/chat-sources";

export const MarkdownOrchestrator = ({
  text,
  sources = [],
}: {
  text: string;
  sources?: ChatSource[];
  isTyping?: boolean;
  showCursor?: boolean;
}) => {
  const normalizedText = normalizeLatexDelimiters(text);
  let displayText = normalizedText;
  if (sources.length > 0) {
    // Convert model citation syntax ([Title][N] or [N]) into direct links
    // so that our link renderer can replace them with inline SourceChips.
    displayText = convertCitationReferencesToLinks(displayText, sources);
    displayText = stripReferenceDefinitions(displayText);
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
      <ReactMarkdown {...sharedReactMarkdownProps} components={effectiveComponents}>
        {displayText}
      </ReactMarkdown>
    </div>
  );
};

function createCitationLink(sources: ChatSource[]) {
  // Map normalized url -> {source, index}
  const byUrl = new Map<string, { source: ChatSource; index: number }>();
  sources.forEach((s, i) => {
    byUrl.set(normalizeUrl(s.url), { source: s, index: i });
  });

  return function CitationLink({ href, children, ...rest }: any) {
    if (href) {
      const hit = byUrl.get(normalizeUrl(href));
      if (hit) {
        // Replace the citation link entirely with a compact source chip at this location in the text.
        // Do not pass index so the pill shows only the domain (matching desired attribution style).
        return <SourceChip source={hit.source} compact />;
      }
    }
    // Fallback to normal link
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
}

export const MarkdownMessage = ({
  content,
  onTypingComplete,
  isStreaming,
  streamKey,
  showCursor = true,
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
      <div className="min-h-[48px] whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-600">
        {content.slice(0, 280)}
        {content.length > 280 ? "…" : ""}
      </div>
    );
  }

  if (detailLevel === "plain" && !isStreaming) {
    return (
      <div className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-800">
        {content}
      </div>
    );
  }

  if (isStreaming && lightweightStream) {
    return (
      <div className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-800">
        {content}
      </div>
    );
  }

  if (isStreaming) {
    // Use FlowToken's AnimatedMarkdown for the fade-in typing animation during streaming.
    // - animation="fadeIn" only while streaming (null afterwards to avoid re-animating / high memory)
    // - sep="diff" ensures only the newly appended tokens receive the animation (optimal for LLM streams)
    // - This follows the recommended pattern for real-time streaming text from LLMs using FlowToken.
    //
    // We strip reference defs (and convert citations for future) for cleaner display while streaming;
    // the final non-stream render will produce the rich inline chips.
    const streamDisplay = sources.length > 0
      ? stripReferenceDefinitions(convertCitationReferencesToLinks(content, sources))
      : content;

    return (
      <div
        className="markdown-content relative min-w-0 max-w-full"
        data-stream-key={streamKey ?? content}
        data-streaming
      >
        <FlowTokenMarkdown
          content={streamDisplay}
          isStreaming
          streamKey={streamKey}
        />
        {showCursor ? <OrbCursor /> : null}
      </div>
    );
  }

  return <MarkdownOrchestrator text={content} sources={sources} />;
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
  showCursor = true,
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
