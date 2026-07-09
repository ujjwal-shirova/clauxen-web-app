"use client";

import React, { useMemo } from "react";
import { tokenizeLines } from "./tokenize";
import { tokenColor } from "./theme";
import { normalizeLanguage } from "./languages";
import type { SyntaxTokenKind } from "./theme";

const CODE_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export type HighlightCodeProps = {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  /** @deprecated no-op — kept for call-site compat after fade removal */
  streamFade?: unknown;
};

function renderToken(
  token: { kind: string; text: string },
  key: string,
) {
  const kind = token.kind as SyntaxTokenKind;
  return (
    <span key={key} style={{ color: tokenColor(kind) }}>
      {token.text}
    </span>
  );
}

export function HighlightCode({
  code,
  language = "text",
  showLineNumbers = true,
  className,
}: HighlightCodeProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const sanitizedCode = code.replace(/\n$/, "");
  const lines = useMemo(
    () => tokenizeLines(sanitizedCode, normalizedLanguage),
    [sanitizedCode, normalizedLanguage],
  );

  const lineNumberWidth = Math.max(String(lines.length || 1).length, 2);

  return (
    <pre
      className={className}
      style={{
        margin: 0,
        padding: "0.75rem 0.875rem 0.75rem 0.625rem",
        background: "transparent",
        fontFamily: CODE_FONT,
        fontSize: "12.5px",
        lineHeight: "1.55",
        color: tokenColor("plain"),
        tabSize: 2,
        whiteSpace: "pre",
        width: "max-content",
        minWidth: "100%",
      }}
    >
      <code style={{ fontFamily: "inherit", fontSize: "inherit" }}>
        {lines.map((lineTokens, lineIndex) => (
          <div
            key={lineIndex}
            className="sh-code-line"
            style={{
              display: "flex",
              alignItems: "flex-start",
              minHeight: "1.55em",
            }}
          >
            {showLineNumbers ? (
              <span
                aria-hidden
                className="sh-line-number select-none"
                style={{
                  flex: "0 0 auto",
                  width: `${lineNumberWidth + 2}ch`,
                  paddingRight: "1rem",
                  textAlign: "right",
                  color: tokenColor("lineNumber"),
                  userSelect: "none",
                }}
              >
                {lineIndex + 1}
              </span>
            ) : null}
            <span className="sh-line-content" style={{ flex: "1 1 auto" }}>
              {lineTokens.length
                ? lineTokens.map((token, tokenIndex) =>
                    renderToken(token, `${lineIndex}-${tokenIndex}`),
                  )
                : "\u00a0"}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}
