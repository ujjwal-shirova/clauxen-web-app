"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import "flowtoken/dist/styles.css";
import { HighlightCode } from "@/frontend/lib/syntax-highlight";
import {
  normalizeLatexDelimiters,
  sharedReactMarkdownProps,
} from "@/frontend/components/markdown-shared";
import {
  useStreamingAnimateText,
  type StreamFadeConfig,
} from "@/frontend/lib/streaming-text-animation";
import {
  StyledH1,
  StyledH2,
  StyledH3,
  StyledParagraph,
  StyledBold,
  StyledItalic,
  StyledInlineCode,
  StyledBlockquote,
  StyledList,
  StyledTableContainer,
  StyledTableHeader,
  StyledTableHeadCell,
  StyledTableBody,
  StyledTableRow,
  StyledTableCell,
  CodeBlockFrame,
  StyledHorizontalRule,
  StyledDetails,
  StyledSummary,
} from "@/frontend/components/markdown-styles";

interface StreamingMarkdownProps {
  content: string;
  streamKey?: string;
}

type AnimateTextFn = ReturnType<typeof useStreamingAnimateText>["animateText"];

function createStreamingBlockCode(
  streamFade: StreamFadeConfig,
  blockAnimationStyle: React.CSSProperties,
) {
  return function StreamingBlockCode({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-([\w+#.-]+)/.exec(className || "");
    const language = match ? match[1] : "text";
    const codeContent = String(children).replace(/\n$/, "");
    const resolvedLanguage = language || "text";

    const handleCopy = () => {
      navigator.clipboard.writeText(codeContent).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    };

    return (
      <div style={blockAnimationStyle}>
        <CodeBlockFrame
          language={resolvedLanguage}
          onCopy={handleCopy}
          isCopied={isCopied}
        >
          <HighlightCode
            code={codeContent}
            language={resolvedLanguage}
            streamFade={streamFade}
          />
        </CodeBlockFrame>
      </div>
    );
  };
}

function createStreamingMarkdownComponents({
  animateText,
  blockAnimationStyle,
  streamFade,
}: {
  animateText: AnimateTextFn;
  blockAnimationStyle: React.CSSProperties;
  streamFade: StreamFadeConfig;
}): Components {
  const StreamingBlockCode = createStreamingBlockCode(
    streamFade,
    blockAnimationStyle,
  );

  return {
    text: ({ children }) => <>{animateText(children)}</>,
    h1: ({ children }) => <StyledH1>{animateText(children)}</StyledH1>,
    h2: ({ children }) => <StyledH2>{animateText(children)}</StyledH2>,
    h3: ({ children }) => <StyledH3>{animateText(children)}</StyledH3>,
    p: ({ children }) => <StyledParagraph>{animateText(children)}</StyledParagraph>,
    strong: ({ children }) => <StyledBold>{animateText(children)}</StyledBold>,
    em: ({ children }) => <StyledItalic>{animateText(children)}</StyledItalic>,
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#3f6f9f] underline decoration-[#3f6f9f]/35 underline-offset-2 transition-colors hover:text-[#2f5f8f]"
      >
        {animateText(children)}
      </a>
    ),
    code: ({
      inline,
      className,
      children,
    }: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
    }) => {
      const match = /language-([\w+#.-]+)/.exec(className || "");
      const language = match ? match[1] : "";

      if (!inline && (language || String(children).includes("\n"))) {
        return (
          <StreamingBlockCode className={className}>{children}</StreamingBlockCode>
        );
      }

      return (
        <StyledInlineCode>{animateText(children)}</StyledInlineCode>
      );
    },
    blockquote: ({ children }) => (
      <StyledBlockquote>{animateText(children)}</StyledBlockquote>
    ),
    ul: ({ children }) => <div className="my-3 space-y-1">{children}</div>,
    ol: ({ children }) => <div className="my-3 space-y-1">{children}</div>,
    li: ({ children, ...props }) => {
      const { ordered, index } = props as {
        ordered?: boolean;
        index?: number;
      };

      return (
        <StyledList
          isOrdered={ordered}
          index={index !== undefined ? index + 1 : undefined}
        >
          {animateText(children)}
        </StyledList>
      );
    },
    table: ({ children }) => (
      <div style={blockAnimationStyle}>
        <StyledTableContainer>{children}</StyledTableContainer>
      </div>
    ),
    thead: ({ children }) => <StyledTableHeader>{children}</StyledTableHeader>,
    th: ({ children }) => (
      <StyledTableHeadCell>{animateText(children)}</StyledTableHeadCell>
    ),
    tbody: ({ children }) => <StyledTableBody>{children}</StyledTableBody>,
    tr: ({ children }) => (
      <StyledTableRow>{animateText(children)}</StyledTableRow>
    ),
    td: ({ children }) => (
      <StyledTableCell>{animateText(children)}</StyledTableCell>
    ),
    hr: () => (
      <div style={blockAnimationStyle}>
        <StyledHorizontalRule />
      </div>
    ),
    details: ({ children }) => (
      <StyledDetails>{children}</StyledDetails>
    ),
    summary: ({ children }) => (
      <StyledSummary>{animateText(children)}</StyledSummary>
    ),
  };
}

export const StreamingAnimatedMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
  streamKey,
}) => {
  const normalizedContent = normalizeLatexDelimiters(content);
  const { animateText, blockAnimationStyle, streamFade } = useStreamingAnimateText({
    animation: "fadeIn",
    animationDuration: "0.45s",
    animationTimingFunction: "ease-out",
    sep: "diff",
  });

  const components = useMemo(
    () =>
      createStreamingMarkdownComponents({
        animateText,
        blockAnimationStyle,
        streamFade,
      }),
    [animateText, blockAnimationStyle, streamFade],
  );

  return (
    <ReactMarkdown
      key={streamKey ?? "assistant-stream"}
      {...sharedReactMarkdownProps}
      components={components}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
};

/** @deprecated Use StreamingAnimatedMarkdown */
export const NativeStreamingInterface = ({
  currentAiStreamText,
  streamKey,
}: {
  currentAiStreamText: string;
  streamKey?: string;
}) => (
  <StreamingAnimatedMarkdown
    content={currentAiStreamText}
    streamKey={streamKey}
  />
);

export default StreamingAnimatedMarkdown;
