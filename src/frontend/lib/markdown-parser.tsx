import React from 'react';

// Parse incoming markdown-like stream into text/code blocks
export const parseStreamToBlocks = (text: string) => {
  const blocks: any[] = [];
  const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)(```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        id: `text-${lastIndex}`,
        type: 'text',
        content: text.slice(lastIndex, match.index),
        isComplete: true,
      });
    }

    const isClosed = match[3] === '```';
    blocks.push({
      id: `code-${match.index}`,
      type: 'code',
      content: match[2],
      language: match[1]?.trim() || 'plaintext',
      isComplete: isClosed,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({
      id: `text-${lastIndex}`,
      type: 'text',
      content: text.slice(lastIndex),
      isComplete: false,
    });
  }

  return blocks;
};

export const OrbCursor = () => (
  <span className="inline-flex items-center justify-center ml-1 translate-y-[2px] align-baseline">
    <span className="w-3 h-3 bg-foreground rounded-full animate-pulse shadow-sm" />
  </span>
);

// Minimal syntax highlighting for inline rendering
export const HighlightedCode = ({ code, hasCursor }: { code: string; hasCursor: boolean }) => {
  const tokenRegex = /(\"(?:[^"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')|(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)|(\b(?:return|if|else|for|while|try|except|switch|case|break|continue|await|yield|import|from|as)\b)|(\b(?:def|class|function|const|let|var|async|new|this|super|void|int|bool|true|false|null|None)\b)|(\b\w+(?=\())|(\b[A-Z]\w*\b)|(\b\d+\.?\d*\b)/gm;
  const elements: any[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<span key={`p-${lastIndex}`} className="text-foreground">{code.slice(lastIndex, match.index)}</span>);
    }

    const [fullMatch, str, comment, control, storage, func, type, number] = match;

    if (str) elements.push(<span key={match.index} className="text-green-600 dark:text-green-400">{str}</span>);
    else if (comment) elements.push(<span key={match.index} className="text-muted-foreground">{comment}</span>);
    else if (control) elements.push(<span key={match.index} className="text-purple-600 dark:text-purple-400">{control}</span>);
    else if (storage) elements.push(<span key={match.index} className="text-blue-600 dark:text-blue-400">{storage}</span>);
    else if (func) elements.push(<span key={match.index} className="text-amber-600 dark:text-amber-400">{func}</span>);
    else if (type) elements.push(<span key={match.index} className="text-cyan-600 dark:text-cyan-400">{type}</span>);
    else if (number) elements.push(<span key={match.index} className="text-pink-600 dark:text-pink-400">{number}</span>);
    else elements.push(<span key={match.index} className="text-foreground">{fullMatch}</span>);

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < code.length) elements.push(<span key={`end-${lastIndex}`} className="text-foreground">{code.slice(lastIndex)}</span>);

  return <>{elements}{hasCursor && <OrbCursor />}</>;
};
