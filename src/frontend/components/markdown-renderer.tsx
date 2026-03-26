
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './code-block';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-base max-w-none text-black prose-p:bg-transparent prose-p:p-0">
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            return match ? (
              <CodeBlock language={match[1]} value={codeString} />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
