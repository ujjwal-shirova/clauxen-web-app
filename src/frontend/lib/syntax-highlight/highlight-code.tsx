"use client";

import React, { useMemo, useRef } from "react";
import {
  computeStreamTokenDurationMs,
  type StreamFadeConfig,
} from "@/frontend/lib/streaming-text-animation";
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
    chunkDurationMs?: number;
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
      className={shouldAnimate ? "stream-token-enter" : undefined}
      style={{
        color: tokenColor(kind),
        ...(shouldAnimate
          ? {
              animationName: options!.streamFade!.animation,
              animationDuration: `${options!.chunkDurationMs ?? 280}ms`,
              animationTimingFunction:
                options!.streamFade!.animationTimingFunction,
              animationIterationCount: 1,
              animationFillMode: "both" as const,
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
  const lastChunkAtRef = useRef(0);
  const chunkDurationMsRef = useRef(280);

  const newContentStart = useMemo(() => {
    if (!streamFade) {
      prevCodeRef.current = sanitizedCode;
      return Number.POSITIVE_INFINITY;
    }

    const previous = prevCodeRef.current;
    if (!previous || sanitizedCode.length < previous.length) {
      prevCodeRef.current = sanitizedCode;
      lastChunkAtRef.current = performance.now();
      chunkDurationMsRef.current = computeStreamTokenDurationMs(
        0,
        sanitizedCode.length,
      );
      return 0;
    }

    if (sanitizedCode.startsWith(previous)) {
      const start = previous.length;
      const deltaLength = sanitizedCode.length - previous.length;
      const now = performance.now();
      const elapsed =
        lastChunkAtRef.current > 0 ? now - lastChunkAtRef.current : 0;
      chunkDurationMsRef.current = computeStreamTokenDurationMs(
        elapsed,
        deltaLength,
      );
      lastChunkAtRef.current = now;
      prevCodeRef.current = sanitizedCode;
      return start;
    }

    prevCodeRef.current = sanitizedCode;
    lastChunkAtRef.current = performance.now();
    chunkDurationMsRef.current = computeStreamTokenDurationMs(
      0,
      sanitizedCode.length,
    );
    return 0;
  }, [sanitizedCode, streamFade]);

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
                  ? lineTokens.map((token, tokenIndex) => {
                      const rendered = renderToken(
                        token,
                        `${lineIndex}-${tokenIndex}`,
                        streamFade
                          ? {
                              charOffset: lineCharOffset,
                              newContentStart,
                              streamFade,
                              chunkDurationMs: chunkDurationMsRef.current,
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
