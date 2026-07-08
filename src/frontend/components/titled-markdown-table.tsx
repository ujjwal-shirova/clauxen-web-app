"use client";

import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { TableTitleContext } from "@/frontend/components/markdown-styles";
import type { ChatSource } from "@/frontend/lib/chat-sources";

/**
 * Renders a `<table_title>`-tagged markdown table with its title/download
 * header. The actual table still goes through the normal markdown pipeline
 * (Streamdown while streaming) — only the title bar is bespoke.
 */
export function TitledMarkdownTable({
  title,
  tableMarkdown,
  isStreaming = false,
  streamKey,
  sources = [],
}: {
  title: string;
  tableMarkdown: string;
  isStreaming?: boolean;
  streamKey?: string;
  sources?: ChatSource[];
}) {
  if (!tableMarkdown.trim()) {
    // Tag arrived but no rows streamed in yet — show the header immediately
    // (matches the create_file card, which also appears before content does)
    // instead of nothing until the first table row lands.
    if (!isStreaming) return null;
    return (
      <div className="composer-message-table my-4 flex min-h-[38px] w-full items-center rounded-[13px] border border-zinc-200/85 bg-white px-4 py-2 shadow-[0_1px_2px_rgba(24,24,27,0.025)]">
        <span className="shimmer-text truncate text-[13px] font-semibold text-zinc-800">
          {title}
        </span>
      </div>
    );
  }

  return (
    <TableTitleContext.Provider value={{ title }}>
      <MarkdownRenderer
        content={tableMarkdown}
        isStreaming={isStreaming}
        streamKey={streamKey}
        sources={sources}
      />
    </TableTitleContext.Provider>
  );
}
