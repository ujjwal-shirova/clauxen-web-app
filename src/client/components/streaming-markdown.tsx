"use client";

import { useMemo } from "react";
import {
  convertCitationReferencesToLinks,
  stripReferenceDefinitions,
  stripTrailingCitationClusters,
  type ChatSource,
} from "@/lib/chat-sources";
import { normalizeLatexDelimiters } from "@/components/markdown-shared";
import { StreamdownStreamingMarkdown } from "@/components/streamdown-markdown";
import { useSmoothStreamingText } from "@/lib/smooth-streaming-text";
import { prepareFollowUpContent } from "@/lib/follow-up-tags";
import { useFollowUpPrompt } from "@/contexts/follow-up-prompt-context";
import { FollowUpPrompt } from "@/components/follow-up-prompt";

export type StreamingMarkdownProps = {
  content: string;
  isStreaming?: boolean;
  /** Stable key (e.g. message id) prevents unnecessary remounts during rapid token appends. */
  streamKey?: string;
  sources?: ChatSource[];
};

/**
 * Real-time streaming markdown — Streamdown for incremental parsing.
 * Follow-up `<prompt>` tags are extracted into dedicated clickable rows
 * (never markdown links — rehype-harden marks unknown protocols as [blocked]).
 */
export function StreamingMarkdown({
  content,
  isStreaming = false,
  streamKey,
  sources = [],
}: StreamingMarkdownProps) {
  const { enabled: followUpsEnabled, onSelect } = useFollowUpPrompt();
  const paintedContent = useSmoothStreamingText(content, {
    active: isStreaming,
    streamKey,
  });

  const { markdown, prompts } = useMemo(() => {
    let text = stripReferenceDefinitions(
      normalizeLatexDelimiters(paintedContent),
    );
    // Always use the streaming strip path for the markdown body so flipping
    // `isStreaming` does not rewrite the answer text (end-of-stream blink).
    const prepared = prepareFollowUpContent(text, {
      enabled: followUpsEnabled,
      isStreaming: true,
    });
    let nextMarkdown = prepared.markdown;
    if (sources.length > 0) {
      // Do not briefly render an appended citation footer while a streamed
      // answer is still being parsed; cited prose is converted below.
      nextMarkdown = stripTrailingCitationClusters(nextMarkdown);
      // Live citation chips as tokens arrive — unwrap paren/comma clusters.
      nextMarkdown = convertCitationReferencesToLinks(nextMarkdown, sources);
    }
    return { markdown: nextMarkdown, prompts: prepared.prompts };
  }, [paintedContent, sources, followUpsEnabled]);

  const showPrompts =
    followUpsEnabled &&
    !isStreaming &&
    prompts.length > 0 &&
    typeof onSelect === "function";

  return (
    <div
      className="markdown-content min-w-0 max-w-full overflow-anchor-none text-[16px] leading-[25px] text-zinc-800"
      data-streaming={isStreaming || undefined}
    >
      <StreamdownStreamingMarkdown
        content={markdown}
        isStreaming={isStreaming}
        sources={sources}
      />
      {showPrompts ? (
        <div
          className="follow-up-list mt-5 flex w-full flex-col gap-1 border-t border-zinc-200/80 pt-3 dark:border-zinc-800 font-sans"
          role="group"
          aria-label="Suggested follow-ups"
        >
          <div className="follow-up-list__title mb-1 px-1 text-[11.5px] font-medium tracking-wider text-zinc-400 dark:text-zinc-500 uppercase select-none">
            Follow-ups
          </div>
          <div className="flex w-full flex-col gap-0.5">
            {prompts.map((prompt) => (
              <FollowUpPrompt key={prompt} prompt={prompt} variant="row" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
