"use client";

import { useMemo, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import { createMathPlugin } from "@streamdown/math";
import {
  CodeRenderer,
  markdownComponents,
  normalizeLatexDelimiters,
} from "@/frontend/components/markdown-shared";
import { createCitationLink } from "@/frontend/components/chat-sources";
import type { ChatSource } from "@/frontend/lib/chat-sources";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: false,
});

type StreamdownStreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  sources?: ChatSource[];
};

/**
 * Streamdown + LaTeX. Streaming uses the same tree as settled — no per-token fade.
 * `parseIncompleteMarkdown` keeps headings, lists, and code fences stable mid-stream.
 */
export function StreamdownStreamingMarkdown({
  content,
  isStreaming = false,
  streamKey = "stream",
  sources = [],
}: StreamdownStreamingMarkdownProps) {
  const normalized = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  const components = useMemo(() => {
    const base = {
      ...markdownComponents,
      code: (codeProps: {
        inline?: boolean;
        className?: string;
        children?: ReactNode;
      }) => <CodeRenderer {...codeProps} />,
    } satisfies Components;

    if (sources.length > 0) {
      return {
        ...base,
        a: createCitationLink(sources),
      };
    }

    return base;
  }, [sources]);

  return (
    <Streamdown
      key={streamKey}
      mode={isStreaming ? "streaming" : "static"}
      isAnimating={isStreaming}
      animated={false}
      parseIncompleteMarkdown={isStreaming}
      className="markdown-content min-w-0 max-w-full text-[14px] leading-[1.55] text-zinc-800"
      plugins={{ math: streamdownMath }}
      components={components}
      lineNumbers={false}
    >
      {normalized}
    </Streamdown>
  );
}
