"use client";

import { useMemo } from "react";
import {
  convertCitationReferencesToLinks,
  stripReferenceDefinitions,
  type ChatSource,
} from "@/frontend/lib/chat-sources";
import { normalizeLatexDelimiters } from "@/frontend/components/markdown-shared";
import { StreamdownStreamingMarkdown } from "@/frontend/components/streamdown-markdown";

export type StreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  /** Stable key (e.g. message id) prevents unnecessary remounts during rapid token appends. */
  streamKey?: string;
  sources?: ChatSource[];
};

/**
 * Real-time streaming markdown — Streamdown for incremental parsing,
 * custom token fade-in on text runs / code / tables.
 */
export function StreamingMarkdown({
  content,
  isStreaming = false,
  streamKey,
  sources = [],
}: StreamingMarkdownProps) {
  const normalized = useMemo(() => {
    let text = stripReferenceDefinitions(normalizeLatexDelimiters(content));
    if (sources.length > 0) {
      text = convertCitationReferencesToLinks(text, sources);
    }
    return text;
  }, [content, sources]);

  return (
    <div
      key={streamKey}
      className="markdown-content min-w-0 max-w-full text-[14px] leading-[1.55] text-zinc-800"
      data-streaming={isStreaming || undefined}
    >
      <StreamdownStreamingMarkdown
        content={normalized}
        isStreaming={isStreaming}
        streamKey={streamKey}
        sources={sources}
      />
    </div>
  );
}
