"use client";

import {
  useMemo,
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
import { StreamingRevealText } from "@/lib/streaming-reveal-text";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: false,
});

type StreamdownStreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  streamKey?: string;
  sources?: ChatSource[];
};

/** Walk streamdown children and apply rate-adaptive reveal to text runs. */
function revealStreamingChildren(
  children: ReactNode,
  isStreaming: boolean,
  streamKey: string,
): ReactNode {
  if (!isStreaming) return children;
  if (children == null || typeof children === "boolean") return children;

  if (typeof children === "string") {
    return children.length > 0 ? (
      <StreamingRevealText text={children} streamKey={streamKey} />
    ) : (
      children
    );
  }

  if (typeof children === "number") {
    const text = String(children);
    return text.length > 0 ? (
      <StreamingRevealText text={text} streamKey={streamKey} />
    ) : (
      children
    );
  }

  if (Array.isArray(children)) {
    return children.map((child, index) =>
      revealStreamingChildren(child, isStreaming, `${streamKey}:${index}`),
    );
  }

  return children;
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
  streamKey = "stream",
  sources = [],
}: StreamdownStreamingMarkdownProps) {
  const normalized = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  const components = useMemo(() => {
    const fade = (children: ReactNode, key = streamKey) =>
      revealStreamingChildren(children, isStreaming, key);

    const base = {
      ...markdownComponents,
      text: ({ children }: { children?: ReactNode }) => <>{fade(children)}</>,
      p: ({ children }: { children?: ReactNode }) => {
        const P = markdownComponents.p;
        if (!P) return <p>{fade(children)}</p>;
        return <P>{fade(children)}</P>;
      },
      li: ({
        children,
        ...props
      }: {
        children?: ReactNode;
        ordered?: boolean;
        index?: number;
      }) => {
        const Li = markdownComponents.li;
        if (!Li) return <li>{fade(children)}</li>;
        return <Li {...props}>{fade(children)}</Li>;
      },
      strong: ({ children }: { children?: ReactNode }) => {
        const Strong = markdownComponents.strong;
        if (!Strong) return <strong>{fade(children)}</strong>;
        return <Strong>{fade(children)}</Strong>;
      },
      em: ({ children }: { children?: ReactNode }) => {
        const Em = markdownComponents.em;
        if (!Em) return <em>{fade(children)}</em>;
        return <Em>{fade(children)}</Em>;
      },
      h1: ({ children }: { children?: ReactNode }) => {
        const H1 = markdownComponents.h1;
        if (!H1) return <h1>{fade(children)}</h1>;
        return <H1>{fade(children)}</H1>;
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const H2 = markdownComponents.h2;
        if (!H2) return <h2>{fade(children)}</h2>;
        return <H2>{fade(children)}</H2>;
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const H3 = markdownComponents.h3;
        if (!H3) return <h3>{fade(children)}</h3>;
        return <H3>{fade(children)}</H3>;
      },
      td: ({ children }: { children?: ReactNode }) => {
        const Td = markdownComponents.td;
        if (!Td) return <td>{fade(children)}</td>;
        return <Td>{fade(children)}</Td>;
      },
      th: ({ children }: { children?: ReactNode }) => {
        const Th = markdownComponents.th;
        if (!Th) return <th>{fade(children)}</th>;
        return <Th>{fade(children)}</Th>;
      },
      code: (codeProps: {
        inline?: boolean;
        className?: string;
        children?: ReactNode;
      }) => <CodeRenderer {...codeProps} />,
      a: createMarkdownLinkRenderer(sources),
    } satisfies Components;

    return base;
  }, [isStreaming, sources, streamKey]);

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
