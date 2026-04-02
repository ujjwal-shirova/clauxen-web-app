import React, { useState, useEffect } from 'react';

import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import remarkMath from 'remark-math';

import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import 'katex/dist/katex.min.css';



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
} from './markdown-styles';

import { OrbCursor } from './ui/orb-cursor';

// VS Code light-like syntax colors with stronger contrast on a light background.
const vscodeStrongLightTheme = {
  ...vs,
  'code[class*="language-"]': {
    ...(vs as any)['code[class*="language-"]'],
    color: '#111827',
    textShadow: 'none',
  },
  'pre[class*="language-"]': {
    ...(vs as any)['pre[class*="language-"]'],
    color: '#111827',
    textShadow: 'none',
  },
  comment: { color: '#0f7a0f' },
  prolog: { color: '#0f7a0f' },
  doctype: { color: '#0f7a0f' },
  cdata: { color: '#0f7a0f' },
  punctuation: { color: '#111827' },
  property: { color: '#0b3ea8' },
  tag: { color: '#7a1f1f' },
  boolean: { color: '#0a2fb8' },
  number: { color: '#0a7a54' },
  constant: { color: '#005a9e' },
  symbol: { color: '#005a9e' },
  deleted: { color: '#8b1a1a' },
  selector: { color: '#7a1f1f' },
  'attr-name': { color: '#9a4b00' },
  string: { color: '#8b1a1a' },
  char: { color: '#8b1a1a' },
  builtin: { color: '#0b7285' },
  inserted: { color: '#0a7a54' },
  operator: { color: '#111111' },
  entity: { color: '#0b7285' },
  url: { color: '#6b4e16' },
  atrule: { color: '#7a1fa2' },
  'attr-value': { color: '#8b1a1a' },
  keyword: { color: '#0a2fb8' },
  function: { color: '#7a4b00' },
  'class-name': { color: '#0b7285' },
  regex: { color: '#6b1d3a' },
  important: { color: '#7a1fa2', fontWeight: '700' },
  variable: { color: '#0b3ea8' },
};

const normalizeLatexDelimiters = (input: string) =>
  input
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_match, expression) => `\n$$\n${expression}\n$$\n`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_match, expression) => `$${expression}$`);

function CodeRenderer({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  if (!inline && language) {
    const content = String(children).replace(/\n$/, '');

    const handleCopy = () => {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    };

    return (
      <CodeBlockFrame language={language} onCopy={handleCopy} isCopied={isCopied}>
        <SyntaxHighlighter
          style={vscodeStrongLightTheme as any}
          language={language}
          PreTag="div"
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '3.25em',
            paddingRight: '1.25em',
            color: '#2f8f3a',
            textAlign: 'right',
            userSelect: 'none',
            fontSize: '13px',
            marginTop: '2px',
          }}
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#111827',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            border: 'none',
          }}
          {...props}
        >
          {content}
        </SyntaxHighlighter>
      </CodeBlockFrame>
    );
  }

  return <StyledInlineCode {...props}>{children}</StyledInlineCode>;
}



// --- COMPONENTS MAP ---



const components = {

  h1: ({ children }: any) => <StyledH1>{children}</StyledH1>,

  h2: ({ children }: any) => <StyledH2>{children}</StyledH2>,

  h3: ({ children }: any) => <StyledH3>{children}</StyledH3>,

  p: ({ children }: any) => <StyledParagraph>{children}</StyledParagraph>,

  strong: ({ children }: any) => <StyledBold>{children}</StyledBold>,

  em: ({ children }: any) => <StyledItalic>{children}</StyledItalic>,

  code: CodeRenderer,

  blockquote: ({ children }: any) => <StyledBlockquote>{children}</StyledBlockquote>,

  ul: ({ children }: any) => <div className="my-3 space-y-1">{children}</div>,

  ol: ({ children }: any) => <div className="my-3 space-y-1">{children}</div>,

  li: ({ children, ...props }: any) => (

    <StyledList isOrdered={props.ordered} index={props.index !== undefined ? props.index + 1 : undefined}>

      {children}

    </StyledList>

  ),

  table: ({ children }: any) => <StyledTableContainer>{children}</StyledTableContainer>,

  thead: ({ children }: any) => <StyledTableHeader>{children}</StyledTableHeader>,

  th: ({ children }: any) => <StyledTableHeadCell>{children}</StyledTableHeadCell>,

  tbody: ({ children }: any) => <StyledTableBody>{children}</StyledTableBody>,

  tr: ({ children }: any) => <StyledTableRow>{children}</StyledTableRow>,

  td: ({ children }: any) => <StyledTableCell>{children}</StyledTableCell>,

  hr: () => <StyledHorizontalRule />,
  details: ({ children }: any) => <StyledDetails>{children}</StyledDetails>,
  summary: ({ children }: any) => <StyledSummary>{children}</StyledSummary>,

};



const CURSOR_SENTINEL = '\uE000';
const TRAILING_CURSOR_SENTINEL_REGEX = new RegExp(`${CURSOR_SENTINEL}+$`);

// Inject cursor only at the terminal render node using a strict trailing marker regex.
const MarkdownContent = ({ children, isTyping }: { children: any; isTyping: boolean }) => {
  const injectCursor = (nodes: any, path = 'root'): any => {
    if (!isTyping) return nodes;

    if (typeof nodes === 'string') {
      if (!TRAILING_CURSOR_SENTINEL_REGEX.test(nodes)) {
        return nodes;
      }

      return (
        <React.Fragment key={`${path}-cursor-wrapper`}>
          {nodes.replace(TRAILING_CURSOR_SENTINEL_REGEX, '')}
          <OrbCursor key={`${path}-cursor`} />
        </React.Fragment>
      );
    }

    if (Array.isArray(nodes)) {
      let lastRenderableIndex = -1;
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        if (nodes[i] !== null && nodes[i] !== undefined && nodes[i] !== false) {
          lastRenderableIndex = i;
          break;
        }
      }

      if (lastRenderableIndex === -1) {
        return nodes;
      }

      const nextNodes = [...nodes];
      nextNodes[lastRenderableIndex] = injectCursor(nextNodes[lastRenderableIndex], `${path}-${lastRenderableIndex}`);
      return nextNodes;
    }

    if (React.isValidElement(nodes) && (nodes.props as any)?.children) {
      return React.cloneElement(nodes, {
        children: injectCursor((nodes.props as any).children, `${path}-c`),
      } as any);
    }

    return nodes;
  };

  return <>{injectCursor(children)}</>;
};



// --- MAIN ORCHESTRATOR ---



export const MarkdownOrchestrator = ({
  text,
  isTyping,
  showCursor = true,
}: {
  text: string;
  isTyping: boolean;
  showCursor?: boolean;
}) => {

  const normalizedText = normalizeLatexDelimiters(text);
  const processedText = isTyping && showCursor ? `${normalizedText}${CURSOR_SENTINEL}` : normalizedText;



  return (

    <div className="markdown-content relative">

      <ReactMarkdown

        remarkPlugins={[remarkGfm, remarkMath]}

        rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'htmlAndMathml', trust: true }]]}

        components={{

          ...components,

          p: ({ children }: any) => (

            <StyledParagraph>

              <MarkdownContent isTyping={isTyping}>{children}</MarkdownContent>

            </StyledParagraph>

          ),

          li: (props: any) => (

            <StyledList isOrdered={props.ordered} index={props.index !== undefined ? props.index + 1 : undefined}>

              <MarkdownContent isTyping={isTyping}>{props.children}</MarkdownContent>

            </StyledList>

          ),

        } as any}

      >

        {processedText}

      </ReactMarkdown>

    </div>

  );

};



export const MarkdownMessage = ({

  content,

  onTypingComplete,

  isStreaming,
  showCursor = true,

}: {

  content: string;

  onTypingComplete?: () => void;

  isStreaming?: boolean;
  showCursor?: boolean;

}) => {

  useEffect(() => {

    if (!isStreaming && onTypingComplete) {

      onTypingComplete();

    }

  }, [isStreaming, onTypingComplete]);



  return <MarkdownOrchestrator text={content} isTyping={!!isStreaming} showCursor={showCursor} />;

};

export const MarkdownRenderer = ({
  content,
  isStreaming = false,
  showCursor = true,
}: {
  content: string;
  isStreaming?: boolean;
  showCursor?: boolean;
}) => (
  <MarkdownMessage content={content} isStreaming={isStreaming} showCursor={showCursor} />
);
