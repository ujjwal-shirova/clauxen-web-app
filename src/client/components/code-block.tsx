"use client";

import { useState } from "react";
import { HighlightCode } from "@/lib/syntax-highlight";
import { CodeBlockFrame } from "@/components/markdown-styles";

interface CodeBlockProps {
  language: string;
  value: string;
}

const SAFE_LANGUAGE_PATTERN = /^[a-zA-Z0-9_+#.-]{1,32}$/;

function safeLanguageLabel(language: string): string {
  return SAFE_LANGUAGE_PATTERN.test(language) ? language : "code";
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const displayLanguage = safeLanguageLabel(language);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <CodeBlockFrame
      language={displayLanguage}
      onCopy={handleCopy}
      isCopied={isCopied}
    >
      <HighlightCode code={value} language={displayLanguage} />
    </CodeBlockFrame>
  );
}
