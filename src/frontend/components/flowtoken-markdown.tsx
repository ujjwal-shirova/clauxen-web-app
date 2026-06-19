"use client";

import { useMemo } from "react";
import { AnimatedMarkdown } from "flowtoken";
import { normalizeLatexDelimiters } from "@/frontend/components/markdown-shared";
import { StreamdownFlowTokenMarkdown } from "@/frontend/components/streamdown-markdown";

const FLOWTOKEN_STREAM = {
  // For real-time LLM streaming we use sep="diff" so that *only the delta* (new tokens)
  // receives the animation. The already-rendered prefix stays untouched.
  // This is the recommended approach for smooth streaming with FlowToken's AnimatedMarkdown.
  // (The basic example in docs often shows sep="word", but "diff" is the streaming-optimized mode.)
  sep: "diff" as const,
  // Use the built-in "fadeIn" animation when streaming. Set to null once done.
  animation: "fadeIn" as const,
  // Keep the fade short so the animation never masks a fast model's real TPS.
  animationDuration: "0.18s",
  animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function contentHasMath(text: string): boolean {
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\(|\\\[/.test(text);
}

export type FlowTokenMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  /** Stable key (e.g. message id) prevents unnecessary remounts during rapid token appends. */
  streamKey?: string;
};

/**
 * Real-time streaming markdown using flowtoken's AnimatedMarkdown for LLM token streaming.
 *
 * Core usage (per FlowToken guidance for fade-in streaming):
 *   <AnimatedMarkdown
 *     content={streamContent}
 *     animation={isStreaming ? "fadeIn" : null}
 *     sep="diff"   // or "word" / "char"
 *     animationDuration="0.18s"
 *     animationTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
 *   />
 *
 * - animation="fadeIn" applies the library's built-in opacity fade-in.
 * - Set animation={null} when !isStreaming to prevent unnecessary work / memory on static content.
 * - sep="diff" is used here for streaming so only newly appended tokens animate (prefix is stable).
 *
 * Falls back to a Streamdown+SplitText variant only when math is present during streaming.
 *
 * References: FlowToken docs + streaming recommendations for LLMs.
 */
export function FlowTokenMarkdown({
  content,
  isStreaming = false,
  streamKey,
}: FlowTokenMarkdownProps) {
  const normalized = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  if (isStreaming && contentHasMath(normalized)) {
    return (
      <StreamdownFlowTokenMarkdown
        content={normalized}
        isStreaming={isStreaming}
      />
    );
  }

  const animation = isStreaming ? FLOWTOKEN_STREAM.animation : null;

  return (
    <div
      key={streamKey}
      className="markdown-content flowtoken-markdown min-w-0 max-w-full text-[14px] leading-[1.55] text-zinc-800"
      data-streaming={isStreaming || undefined}
    >
      <AnimatedMarkdown
        content={normalized}
        sep={FLOWTOKEN_STREAM.sep}
        animation={animation}
        animationDuration={FLOWTOKEN_STREAM.animationDuration}
        animationTimingFunction={FLOWTOKEN_STREAM.animationTimingFunction}
      />
    </div>
  );
}
