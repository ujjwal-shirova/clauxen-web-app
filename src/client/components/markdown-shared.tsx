"use client";

import React, { useState } from "react";
import type { Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { HighlightCode } from "@/lib/syntax-highlight";
import { extensionForLanguage } from "@/lib/create-file-tags";
import { downloadTextFile } from "@/lib/download-file";
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
} from "./markdown-styles";

export const normalizeLatexDelimiters = (input: string) =>
  input
    .replace(
      /\\\[((?:.|\n)*?)\\\]/g,
      (_match, expression) => `\n$$\n${expression}\n$$\n`,
    )
    .replace(
      /\\\(((?:.|\n)*?)\\\)/g,
      (_match, expression) => `$${expression}$`,
    );

export function CodeRenderer(props: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** @deprecated no-op */
  streamFade?: unknown;
  /** Keep unfinished code cheap; syntax highlighting runs once after completion. */
  isStreaming?: boolean;
}) {
  const {
    inline,
    className,
    children,
    streamFade: _streamFade,
    isStreaming = false,
    ...rest
  } = props;
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-([\w+#.-]+)/.exec(className || "");
  const language = match ? match[1] : "";

  if (!inline && (language || String(children).includes("\n"))) {
    const content = String(children).replace(/\n$/, "");
    const resolvedLanguage = language || "text";
    const extension = extensionForLanguage(resolvedLanguage);

    const handleCopy = () => {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    };

    const handleDownload = () => {
      downloadTextFile(`code.${extension}`, content);
    };

    return (
      <CodeBlockFrame
        language={resolvedLanguage}
        onCopy={handleCopy}
        isCopied={isCopied}
        onDownload={isStreaming ? undefined : handleDownload}
        downloadExtension={extension}
      >
        {isStreaming ? (
          <pre className="m-0 min-w-full whitespace-pre bg-transparent px-3.5 py-4 font-mono text-[14px] leading-[1.6] text-zinc-800">
            <code>{content}</code>
          </pre>
        ) : (
          <HighlightCode code={content} language={resolvedLanguage} />
        )}
      </CodeBlockFrame>
    );
  }

  return <StyledInlineCode {...rest}>{children}</StyledInlineCode>;
}

export const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <StyledH1>{children}</StyledH1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <StyledH2>{children}</StyledH2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <StyledH3>{children}</StyledH3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <StyledParagraph>{children}</StyledParagraph>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <StyledBold>{children}</StyledBold>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <StyledItalic>{children}</StyledItalic>
  ),
  code: CodeRenderer,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <StyledBlockquote>{children}</StyledBlockquote>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 space-y-0">{children}</div>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 space-y-0">{children}</div>
  ),
  li: ({
    children,
    ordered,
    index,
  }: {
    children?: React.ReactNode;
    ordered?: boolean;
    index?: number;
  }) => (
    <StyledList
      isOrdered={ordered}
      index={index !== undefined ? index + 1 : undefined}
    >
      {children}
    </StyledList>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableContainer>{children}</StyledTableContainer>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableHeader>{children}</StyledTableHeader>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableHeadCell>{children}</StyledTableHeadCell>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableBody>{children}</StyledTableBody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableRow>{children}</StyledTableRow>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <StyledTableCell>{children}</StyledTableCell>
  ),
  hr: () => <StyledHorizontalRule />,
  details: ({ children }: { children?: React.ReactNode }) => (
    <StyledDetails>{children}</StyledDetails>
  ),
  summary: ({ children }: { children?: React.ReactNode }) => (
    <StyledSummary>{children}</StyledSummary>
  ),
};

export const sharedReactMarkdownProps: Options = {
  remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]],
  rehypePlugins: [
    // No rehype-raw — model/user HTML must not execute as DOM.
    [rehypeKatex, { output: "htmlAndMathml", trust: false }],
  ],
  components: markdownComponents as Options["components"],
};
