"use client";

import React, { useState } from "react";
import type { Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/cjs/styles/prism";
import "katex/dist/katex.min.css";
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

const vscodeStrongLightTheme = {
  ...(vs as Record<string, unknown>),
  'code[class*="language-"]': {
    ...((vs as Record<string, Record<string, unknown>>)['code[class*="language-"]'] ?? {}),
    color: "#111827",
    textShadow: "none",
  },
  'pre[class*="language-"]': {
    ...((vs as Record<string, Record<string, unknown>>)['pre[class*="language-"]'] ?? {}),
    color: "#111827",
    textShadow: "none",
  },
  comment: { color: "#0f7a0f" },
  prolog: { color: "#0f7a0f" },
  doctype: { color: "#0f7a0f" },
  cdata: { color: "#0f7a0f" },
  punctuation: { color: "#111827" },
  property: { color: "#0b3ea8" },
  tag: { color: "#7a1f1f" },
  boolean: { color: "#0a2fb8" },
  number: { color: "#0a7a54" },
  constant: { color: "#005a9e" },
  symbol: { color: "#005a9e" },
  deleted: { color: "#8b1a1a" },
  selector: { color: "#7a1f1f" },
  "attr-name": { color: "#9a4b00" },
  string: { color: "#8b1a1a" },
  char: { color: "#8b1a1a" },
  builtin: { color: "#0b7285" },
  inserted: { color: "#0a7a54" },
  operator: { color: "#111111" },
  entity: { color: "#0b7285" },
  url: { color: "#6b4e16" },
  atrule: { color: "#7a1fa2" },
  "attr-value": { color: "#8b1a1a" },
  keyword: { color: "#0a2fb8" },
  function: { color: "#7a4b00" },
  "class-name": { color: "#0b7285" },
  regex: { color: "#6b1d3a" },
  important: { color: "#7a1fa2", fontWeight: "700" },
  variable: { color: "#0b3ea8" },
};

export const normalizeLatexDelimiters = (input: string) =>
  input
    .replace(
      /\\\[((?:.|\n)*?)\\\]/g,
      (_match, expression) => `\n$$\n${expression}\n$$\n`,
    )
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_match, expression) => `$${expression}$`);

function CodeRenderer(props: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { inline, className, children, ...rest } = props;
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  if (!inline && language) {
    const content = String(children).replace(/\n$/, "");

    const handleCopy = () => {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    };

    return (
      <CodeBlockFrame language={language} onCopy={handleCopy} isCopied={isCopied}>
        <SyntaxHighlighter
          style={vscodeStrongLightTheme as Record<string, React.CSSProperties>}
          language={language}
          PreTag="div"
          showLineNumbers
          lineNumberStyle={{
            minWidth: "3.25em",
            paddingRight: "1.25em",
            color: "#2f8f3a",
            textAlign: "right",
            userSelect: "none",
            fontSize: "13px",
            marginTop: "2px",
          }}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.65",
            color: "#111827",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            border: "none",
            width: "max-content",
            minWidth: "100%",
            maxWidth: "none",
          }}
          {...rest}
        >
          {content}
        </SyntaxHighlighter>
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
    <div className="my-3 space-y-1">{children}</div>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-3 space-y-1">{children}</div>
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
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeRaw, [rehypeKatex, { output: "htmlAndMathml", trust: true }]],
  components: markdownComponents as Options["components"],
};
