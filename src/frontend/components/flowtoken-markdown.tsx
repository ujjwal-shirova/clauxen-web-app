"use client";

import { useMemo } from "react";
import { normalizeLatexDelimiters } from "@/frontend/components/markdown-shared";
import { StreamdownFlowTokenMarkdown } from "@/frontend/components/streamdown-markdown";

export type FlowTokenMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  /** Stable key (e.g. message id) prevents unnecessary remounts during rapid token appends. */
  streamKey?: string;
};

/**
 * Real-time streaming markdown via Streamdown with rate-adaptive token reveal.
 */
export function FlowTokenMarkdown({
  content,
  isStreaming = false,
  streamKey,
}: FlowTokenMarkdownProps) {
  const normalized = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  return (
    <div
      key={streamKey}
      className="markdown-content flowtoken-markdown min-w-0 max-w-full text-[14px] leading-[1.55] text-zinc-800"
      data-streaming={isStreaming || undefined}
    >
      <StreamdownFlowTokenMarkdown
        content={normalized}
        isStreaming={isStreaming}
        streamKey={streamKey}
      />
    </div>
  );
}
