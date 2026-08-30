"use client";

import {
  useMemo,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import { createMathPlugin } from "@streamdown/math";
import {
  CodeRenderer,
  markdownComponents,
  normalizeLatexDelimiters,
} from "@/components/markdown-shared";
import { createCitationLink } from "@/components/chat-sources";
import type { ChatSource } from "@/lib/chat-sources";
import { FollowUpPrompt } from "@/components/follow-up-prompt";
import { parseClauxenPromptHref } from "@/lib/follow-up-tags";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: false,
});

type StreamdownStreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  sources?: ChatSource[];
};

function useStableSources(sources: ChatSource[]): ChatSource[] {
  const signature = JSON.stringify(sources);
  const cacheRef = useRef<{ signature: string; sources: ChatSource[] } | null>(
    null,
  );

  if (!cacheRef.current || cacheRef.current.signature !== signature) {
    cacheRef.current = { signature, sources };
  }

  return cacheRef.current.sources;
}

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
 * Streamdown + LaTeX with rate-adaptive token reveal on new text during streaming.
 * `parseIncompleteMarkdown` keeps headings, lists, and code fences stable mid-stream.
 */
export function StreamdownStreamingMarkdown({
  content,
  isStreaming = false,
  sources = [],
}: StreamdownStreamingMarkdownProps) {
  // Keep the components map stable when a stream settles. Streamdown treats a
  // new renderer map as a new markdown tree, which would flash the final frame.
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  const stableSources = useStableSources(sources);
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
      }) => (
        <CodeRenderer {...codeProps} isStreaming={isStreamingRef.current} />
      ),
      a: createMarkdownLinkRenderer(stableSources),
    } satisfies Components;

    return base;
  }, [stableSources]);

  return (
    <Streamdown
      // Keep mode stable across stream→settled so Streamdown does not remount
      // the whole markdown tree (that remount caused a visible blink).
      mode="streaming"
      isAnimating={false}
      animated={false}
      parseIncompleteMarkdown
      className="markdown-content min-w-0 max-w-full text-[16px] leading-[25px] text-zinc-800"
      plugins={{ math: streamdownMath }}
      components={components}
      lineNumbers={false}
    >
      {normalized}
    </Streamdown>
  );
}
