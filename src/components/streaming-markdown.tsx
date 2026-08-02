"use client";

import { useMemo } from "react";
import {
  convertCitationReferencesToLinks,
  stripReferenceDefinitions,
  type ChatSource,
} from "@/lib/chat-sources";
import { normalizeLatexDelimiters } from "@/components/markdown-shared";
import { StreamdownStreamingMarkdown } from "@/components/streamdown-markdown";
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

  const { markdown, prompts } = useMemo(() => {
    let text = stripReferenceDefinitions(normalizeLatexDelimiters(content));
    // Always use the streaming strip path for the markdown body so flipping
    // `isStreaming` does not rewrite the answer text (end-of-stream blink).
    const prepared = prepareFollowUpContent(text, {
      enabled: followUpsEnabled,
      isStreaming: true,
    });
    let nextMarkdown = prepared.markdown;
    if (sources.length > 0) {
      nextMarkdown = convertCitationReferencesToLinks(nextMarkdown, sources);
    }
    return { markdown: nextMarkdown, prompts: prepared.prompts };
  }, [content, sources, followUpsEnabled]);

  const showPrompts =
    followUpsEnabled &&
    !isStreaming &&
    prompts.length > 0 &&
    typeof onSelect === "function";

  return (
    <div
      className="markdown-content min-w-0 max-w-full text-[13px] leading-[18px] text-zinc-800"
      data-streaming={isStreaming || undefined}
    >
      <StreamdownStreamingMarkdown
        content={markdown}
        isStreaming={isStreaming}
        streamKey={streamKey}
        sources={sources}
      />
      {showPrompts ? (
        <div
          className="follow-up-prompt-list mt-4 flex w-full flex-col gap-2.5 font-sans"
          role="group"
          aria-label="Suggested follow-ups"
        >
          {prompts.map((prompt) => (
            <FollowUpPrompt key={prompt} prompt={prompt} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
