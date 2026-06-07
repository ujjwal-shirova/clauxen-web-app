
'use client';

import { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  value: string;
}

const SAFE_LANGUAGE_PATTERN = /^[a-zA-Z0-9_+#.-]{1,32}$/;

function safeLanguageLabel(language: string): string {
  return SAFE_LANGUAGE_PATTERN.test(language) ? language : 'code';
}

export function CodeBlock({ language, value }: CodeBlockProps) { // fenced code UI — toolbar + monospace body
  const [isCopied, setIsCopied] = useState(false);
  const displayLanguage = safeLanguageLabel(language);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden my-4 bg-[#1e1e1e] shadow-lg"> 
      <div className="flex justify-between items-center px-4 py-2 bg-gray-700 text-white"> 
        <span className="text-xs font-sans uppercase">{displayLanguage}</span> 
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
        >
          {isCopied ? (
            <>
              <Check size={14} />
              {/* Copied! — user-facing string unchanged */}
              Copied!
            </>
          ) : (
            <>
              <Clipboard size={14} />
              {/* Copy code — user-facing string unchanged */}
              Copy code
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto"> 
        <pre className="m-0 bg-[#1e1e1e] p-4 text-sm text-[#d4d4d4]"> 
          <code className="font-mono">{value}</code> {/* monospace code body — value as-is render */}
        </pre>
      </div>
    </div>
  );
}
