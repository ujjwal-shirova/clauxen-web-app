"use client";

import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Streamdown, type Components } from "streamdown";
import { createMathPlugin } from "@streamdown/math";
import "streamdown/styles.css";
import { OrbCursor } from "@/frontend/components/ui/orb-cursor";
import {
  markdownComponents,
  normalizeLatexDelimiters,
  sharedReactMarkdownProps,
} from "@/frontend/components/markdown-shared";

const streamingMath = createMathPlugin({ singleDollarTextMath: true });

export const MarkdownOrchestrator = ({
  text,
}: {
  text: string;
  isTyping?: boolean;
  showCursor?: boolean;
}) => {
  const normalizedText = normalizeLatexDelimiters(text);

  return (
    <div className="markdown-content relative min-w-0 max-w-full overflow-hidden">
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
}: {
  content: string;
  onTypingComplete?: () => void;
  isStreaming?: boolean;
  streamKey?: string;
  showCursor?: boolean;
  /** Plain pre-wrap during stream (no markdown/blur) — used for thinking panel. */
  lightweightStream?: boolean;
}) => {
  useEffect(() => {
    if (!isStreaming && onTypingComplete) {
      onTypingComplete();
    }
  }, [isStreaming, onTypingComplete]);

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
        <Streamdown
          animated={{ animation: "blurIn", sep: "word" }}
          isAnimating
          mode="streaming"
          plugins={{ math: streamingMath }}
          components={markdownComponents as unknown as Components}
        >
          {normalizeLatexDelimiters(content)}
        </Streamdown>
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
}: {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  showCursor?: boolean;
  lightweightStream?: boolean;
}) => (
  <MarkdownMessage
    content={content}
    isStreaming={isStreaming}
    streamKey={streamKey}
    showCursor={showCursor}
    lightweightStream={lightweightStream}
  />
);
