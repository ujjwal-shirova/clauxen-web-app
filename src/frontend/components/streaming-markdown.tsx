"use client";

import { AnimatedMarkdown } from "flowtoken";
import React, { useMemo } from "react";
import { normalizeLatexDelimiters } from "@/frontend/components/markdown-shared";

interface StreamingMarkdownProps {
  content: string;
  streamKey?: string;
}

export const StreamingAnimatedMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
}) => {
  const normalizedContent = useMemo(
    () => normalizeLatexDelimiters(content),
    [content],
  );

  return (
    <div className="markdown-content flowtoken-markdown min-w-0 max-w-full">
      <AnimatedMarkdown
        content={normalizedContent}
        sep="diff"
        animation="fadeIn"
        animationDuration="0.32s"
        animationTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
      />
    </div>
  );
};

/** @deprecated Use StreamingAnimatedMarkdown */
export const NativeStreamingInterface = ({
  currentAiStreamText,
}: {
  currentAiStreamText: string;
  streamKey?: string;
}) => <StreamingAnimatedMarkdown content={currentAiStreamText} />;

export default StreamingAnimatedMarkdown;
