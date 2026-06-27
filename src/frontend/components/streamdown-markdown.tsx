"use client";

import { useMemo, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import { createMathPlugin } from "@streamdown/math";
import {
  markdownComponents,
  normalizeLatexDelimiters,
} from "@/frontend/components/markdown-shared";
import { StreamingRevealText } from "@/frontend/lib/streaming-reveal-text";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: true,
});

type StreamdownFlowTokenMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
};

function streamingText(
  children: ReactNode,
  isStreaming: boolean,
  streamKey: string,
): ReactNode {
  if (!isStreaming) return children;
  if (typeof children === "string" && children.length > 0) {
    return <StreamingRevealText text={children} streamKey={streamKey} />;
  }
  return children;
}

/**
 * Streamdown + LaTeX with rate-adaptive token reveal on new text during streaming.
 * `parseIncompleteMarkdown` keeps headings, lists, and code fences stable mid-stream.
 */
export function StreamdownFlowTokenMarkdown({
  content,
  isStreaming = false,
  streamKey = "stream",
}: StreamdownFlowTokenMarkdownProps) {
  const normalized = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  const components = useMemo(() => {
    const fade = (children: ReactNode) =>
      streamingText(children, isStreaming, streamKey);

    return {
      ...markdownComponents,
      text: ({ children }: { children?: React.ReactNode }) => (
        <>{fade(children)}</>
      ),
      p: ({ children }: { children?: React.ReactNode }) => {
        const P = markdownComponents.p;
        if (!P) return <p>{fade(children)}</p>;
        return <P>{fade(children)}</P>;
      },
      li: ({
        children,
        ...props
      }: {
        children?: React.ReactNode;
        ordered?: boolean;
        index?: number;
      }) => {
        const Li = markdownComponents.li;
        if (!Li) return <li>{fade(children)}</li>;
        return <Li {...props}>{fade(children)}</Li>;
      },
      strong: ({ children }: { children?: React.ReactNode }) => {
        const Strong = markdownComponents.strong;
        if (!Strong) return <strong>{fade(children)}</strong>;
        return <Strong>{fade(children)}</Strong>;
      },
      em: ({ children }: { children?: React.ReactNode }) => {
        const Em = markdownComponents.em;
        if (!Em) return <em>{fade(children)}</em>;
        return <Em>{fade(children)}</Em>;
      },
      h1: ({ children }: { children?: React.ReactNode }) => {
        const H1 = markdownComponents.h1;
        if (!H1) return <h1>{fade(children)}</h1>;
        return <H1>{fade(children)}</H1>;
      },
      h2: ({ children }: { children?: React.ReactNode }) => {
        const H2 = markdownComponents.h2;
        if (!H2) return <h2>{fade(children)}</h2>;
        return <H2>{fade(children)}</H2>;
      },
      h3: ({ children }: { children?: React.ReactNode }) => {
        const H3 = markdownComponents.h3;
        if (!H3) return <h3>{fade(children)}</h3>;
        return <H3>{fade(children)}</H3>;
      },
      td: ({ children }: { children?: React.ReactNode }) => {
        const Td = markdownComponents.td;
        if (!Td) return <td>{fade(children)}</td>;
        return <Td>{fade(children)}</Td>;
      },
      th: ({ children }: { children?: React.ReactNode }) => {
        const Th = markdownComponents.th;
        if (!Th) return <th>{fade(children)}</th>;
        return <Th>{fade(children)}</Th>;
      },
    } satisfies Components;
  }, [isStreaming, streamKey]);

  return (
    <Streamdown
      mode="streaming"
      isAnimating={isStreaming}
      animated={false}
      parseIncompleteMarkdown
      className="markdown-content min-w-0 max-w-full text-[14px] leading-[1.55] text-zinc-800"
      plugins={{ math: streamdownMath }}
      components={components}
      lineNumbers={false}
    >
      {normalized}
    </Streamdown>
  );
}

/** @deprecated Use FlowTokenMarkdown */
export const StreamdownMarkdown = StreamdownFlowTokenMarkdown;
