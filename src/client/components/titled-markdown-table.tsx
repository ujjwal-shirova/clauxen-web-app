"use client";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TableTitleContext } from "@/components/markdown-styles";
import type { ChatSource } from "@/lib/chat-sources";

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
      <div className="composer-message-table my-4 flex min-h-[46px] w-full items-center rounded-2xl border border-zinc-200/90 bg-white px-4 py-2 shadow-[0_2px_8px_rgba(24,24,27,0.04)]">
        <span
          className="shimmer-text truncate text-[13px] font-semibold text-zinc-800"
          data-shimmer-active="true"
        >
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
