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
import { StreamingAnimatedMarkdown } from "./streaming-markdown";

export const MarkdownOrchestrator = ({
  text,
}: {
  text: string;
  isTyping?: boolean;
  showCursor?: boolean;
}) => {
  const normalizedText = normalizeLatexDelimiters(text);

  return (
    <div className="markdown-content relative min-w-0 max-w-full">
      <ReactMarkdown {...sharedReactMarkdownProps}>
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownMessage = ({
  content,
  onTypingComplete,
  isStreaming,
  streamKey,
  showCursor = true,
  lightweightStream = false,
  detailLevel = "full",
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
}) => {
  useEffect(() => {
    if (!isStreaming && onTypingComplete) {
      onTypingComplete();
    }
  }, [isStreaming, onTypingComplete]);

  if (detailLevel === "placeholder") {
    return (
      <div
        className="min-h-[48px] truncate text-[14px] leading-[1.55] text-zinc-500"
        aria-hidden
      >
        {content.slice(0, 120)}
        {content.length > 120 ? "…" : ""}
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
    return (
      <div
        className="markdown-content relative min-w-0 max-w-full"
        data-stream-key={streamKey ?? content}
      >
        <StreamingAnimatedMarkdown content={content} streamKey={streamKey} />
        {showCursor ? <OrbCursor /> : null}
      </div>
    );
  }

  return <MarkdownOrchestrator text={content} />;
};

export const MarkdownRenderer = ({
  content,
  isStreaming = false,
  streamKey,
  showCursor = true,
  lightweightStream = false,
  detailLevel = "full",
}: {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  showCursor?: boolean;
  lightweightStream?: boolean;
  detailLevel?: MessageDetailLevel;
}) => (
  <MarkdownMessage
    content={content}
    isStreaming={isStreaming}
    streamKey={streamKey}
    showCursor={showCursor}
    lightweightStream={lightweightStream}
    detailLevel={detailLevel}
  />
);
