import React, { useState, useEffect } from 'react';

import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import remarkMath from 'remark-math';

import rehypeKatex from 'rehype-katex';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

// Changed from oneDark to vs (Visual Studio Light) to match the white theme requirement
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
} from './markdown-styles';

import { OrbCursor } from './ui/orb-cursor';

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
          style={vs}
          language={language}
          PreTag="div"
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '3.25em',
            paddingRight: '1.25em',
            color: '#6e7781',
            textAlign: 'right',
            userSelect: 'none',
            fontSize: '14px',
            marginTop: '2px',
          }}
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '15px',
            lineHeight: '1.7',
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

};



// Custom renderer to handle the cursor marker

const MarkdownContent = ({ children, isTyping }: { children: any; isTyping: boolean }) => {

  const injectCursor = (nodes: any, path = 'root'): any => {

    if (!isTyping) return nodes;



    if (typeof nodes === 'string') {

      if (nodes.endsWith('█')) {

        return (

          <React.Fragment key={`${path}-cursor-wrapper`}>

            {nodes.slice(0, -1)}

            <OrbCursor key={`${path}-cursor`} />

          </React.Fragment>

        );

      }

      return nodes;

    }



    if (Array.isArray(nodes)) {

      const lastIdx = nodes.length - 1;

      return nodes.map((node, i) => {

        const key = (React.isValidElement(node) && node.key) || `${path}-${i}`;

        return i === lastIdx ? injectCursor(node, `${path}-${i}`) : React.cloneElement(React.isValidElement(node) ? node : <React.Fragment key={key}>{node}</React.Fragment>, { key } as any);

      });

    }



    if (React.isValidElement(nodes)) {

      const key = nodes.key || path;

      if ((nodes.props as any).children) {

        return React.cloneElement(nodes, {

          key,

          children: injectCursor((nodes.props as any).children, `${path}-c`),

        } as any);

      }

      return React.cloneElement(nodes, { key } as any);

    }



    return nodes;

  };



  return <>{injectCursor(children)}</>;

};



// --- MAIN ORCHESTRATOR ---



export const MarkdownOrchestrator = ({ text, isTyping }: { text: string; isTyping: boolean }) => {

  const processedText = isTyping ? text + "█" : text;



  return (

    <div className="markdown-content relative">

      <ReactMarkdown

        remarkPlugins={[remarkGfm, remarkMath]}

        rehypePlugins={[[rehypeKatex, { output: 'htmlAndMathml', trust: true }]]}

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

  isStreaming

}: {

  content: string;

  onTypingComplete?: () => void;

  isStreaming?: boolean;

}) => {

  useEffect(() => {

    if (!isStreaming && onTypingComplete) {

      onTypingComplete();

    }

  }, [isStreaming, onTypingComplete]);



  return <MarkdownOrchestrator text={content} isTyping={!!isStreaming} />;

};

export const MarkdownRenderer = ({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) => (
  <MarkdownMessage content={content} isStreaming={isStreaming} />
);
