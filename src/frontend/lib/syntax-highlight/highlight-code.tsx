"use client";

import React, { useMemo, useRef } from "react";
import type { StreamFadeConfig } from "@/frontend/lib/streaming-text-animation";
import { tokenizeLines } from "./tokenize";
import { tokenColor } from "./theme";
import { normalizeLanguage } from "./languages";

const CODE_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export type HighlightCodeProps = {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  /** Fade-in newly streamed tokens while the assistant message is still streaming. */
  streamFade?: StreamFadeConfig;
};

import type { SyntaxTokenKind } from "./theme";

function renderToken(
  token: { kind: string; text: string },
  key: string,
  options?: {
    charOffset: number;
    newContentStart: number;
    streamFade?: StreamFadeConfig;
  },
) {
  const kind = token.kind as SyntaxTokenKind;
  const charOffset = options?.charOffset ?? 0;
  const shouldAnimate =
    options?.streamFade !== undefined &&
    charOffset >= (options?.newContentStart ?? 0);

  return (
    <span
      key={key}
      style={{
        color: tokenColor(kind),
        ...(shouldAnimate
          ? {
              animationName: options!.streamFade!.animation,
              animationDuration: options!.streamFade!.animationDuration,
              animationTimingFunction:
                options!.streamFade!.animationTimingFunction,
              animationIterationCount: 1,
              display: "inline-block",
            }
          : {}),
      }}
    >
      {token.text}
    </span>
  );
}

export function HighlightCode({
  code,
  language = "text",
  showLineNumbers = true,
  className,
  streamFade,
}: HighlightCodeProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const sanitizedCode = code.replace(/\n$/, "");
  const lines = useMemo(
    () => tokenizeLines(sanitizedCode, normalizedLanguage),
    [sanitizedCode, normalizedLanguage],
  );

  const prevCodeRef = useRef("");
  const newContentStart = useMemo(() => {
    if (!streamFade) {
      prevCodeRef.current = sanitizedCode;
      return Number.POSITIVE_INFINITY;
    }

    const previous = prevCodeRef.current;
    if (!previous || sanitizedCode.length < previous.length) {
      prevCodeRef.current = sanitizedCode;
      return 0;
    }

    if (sanitizedCode.startsWith(previous)) {
      const start = previous.length;
      prevCodeRef.current = sanitizedCode;
      return start;
    }

    prevCodeRef.current = sanitizedCode;
    return 0;
  }, [sanitizedCode, streamFade]);

  const lineNumberWidth = Math.max(String(lines.length || 1).length, 2);

  return (
    <pre
      className={className}
      style={{
        margin: 0,
        padding: "1rem 1rem 1rem 0.75rem",
        background: "transparent",
        fontFamily: CODE_FONT,
        fontSize: "13px",
        lineHeight: "1.65",
        color: tokenColor("plain"),
        tabSize: 2,
        whiteSpace: "pre",
        width: "max-content",
        minWidth: "100%",
      }}
    >
      <code style={{ fontFamily: "inherit", fontSize: "inherit" }}>
        {lines.map((lineTokens, lineIndex) => {
          let lineCharOffset = lines
            .slice(0, lineIndex)
            .reduce(
              (offset, tokens) =>
                offset +
                tokens.reduce((sum, token) => sum + token.text.length, 0) +
                1,
              0,
            );

          return (
            <div
              key={lineIndex}
              className="sh-code-line"
              style={{
                display: "flex",
                alignItems: "flex-start",
                minHeight: "1.65em",
              }}
            >
              {showLineNumbers ? (
                <span
                  aria-hidden
                  className="sh-line-number select-none"
                  style={{
                    flex: "0 0 auto",
                    width: `${lineNumberWidth + 2}ch`,
                    paddingRight: "1.25rem",
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
                  ? lineTokens.map((token, tokenIndex) => {
                      const rendered = renderToken(
                        token,
                        `${lineIndex}-${tokenIndex}`,
                        streamFade
                          ? {
                              charOffset: lineCharOffset,
                              newContentStart,
                              streamFade,
                            }
                          : undefined,
                      );
                      lineCharOffset += token.text.length;
                      return rendered;
                    })
                  : "\u00a0"}
              </span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}
