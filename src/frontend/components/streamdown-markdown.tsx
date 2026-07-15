"use client";

import { useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";
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
import { FollowUpPrompt } from "@/frontend/components/follow-up-prompt";
import { parseClauxenPromptHref } from "@/frontend/lib/follow-up-tags";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: false,
});

type StreamdownStreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  sources?: ChatSource[];
};

function createMarkdownLinkRenderer(sources: ChatSource[]) {
  const CitationLink = sources.length > 0 ? createCitationLink(sources) : null;

  return function MarkdownLink(
    props: AnchorHTMLAttributes<HTMLAnchorElement> & {
      node?: unknown;
      children?: ReactNode;
    },
  ) {
    const { href, children, ...rest } = props;
    const prompt = parseClauxenPromptHref(href);
    if (prompt) {
      return <FollowUpPrompt prompt={prompt} />;
    }
    if (CitationLink) {
      return (
        <CitationLink href={href} {...rest}>
          {children}
        </CitationLink>
      );
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
}

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
      a: createMarkdownLinkRenderer(sources),
    } satisfies Components;

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
