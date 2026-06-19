"use client";

import React from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { collectChatSources, collectMessageSources, type ChatSource } from "@/frontend/lib/chat-sources";
import type { Message } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";

function SourceFavicon({
  source,
  className,
}: {
  source: Pick<ChatSource, "favicon" | "domain">;
  className?: string;
}) {
  const src =
    source.favicon ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("h-4 w-4 shrink-0 rounded-full border border-zinc-200 bg-white", className)}
    />
  );
}

export function SourcePreviewCard({ source }: { source: ChatSource }) {
  const excerpt =
    source.highlights?.find((highlight) => highlight.trim()) ?? source.snippet;

  return (
    <div className="w-[min(320px,calc(100vw-32px))] rounded-[14px] border border-zinc-200 bg-white p-3 text-left shadow-[0_10px_30px_-15px_rgba(24,24,27,0.25)]">
      <div className="mb-2 flex items-center gap-2">
        <SourceFavicon source={source} className="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-zinc-800">
            {source.domain}
          </p>
          {source.publishedDate ? (
            <p className="truncate text-[11px] text-zinc-500">
              {new Date(source.publishedDate).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-zinc-900">
        {source.title || source.url}
      </p>
      {excerpt ? (
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-[1.4] text-zinc-600">
          {excerpt}
        </p>
      ) : null}
    </div>
  );
}

export function SourceChip({
  source,
  index,
  compact = false,
}: {
  source: ChatSource;
  index?: number;
  compact?: boolean;
}) {
  const sizeClasses = compact
    ? "h-6 max-w-[160px] gap-1 rounded-full px-1.5 text-[11px]"
    : "h-7 max-w-[200px] gap-1.5 rounded-full px-2 text-[12px]";

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group/source relative inline-flex items-center border border-zinc-200 bg-white font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50",
        sizeClasses,
      )}
    >
      <SourceFavicon
        source={source}
        className={compact ? "h-4 w-4" : "h-[15px] w-[15px]"}
      />
      <span className="truncate leading-none">{source.domain}</span>
      {index != null ? (
        <span className="text-[10px] text-zinc-400">{index + 1}</span>
      ) : null}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 hidden group-hover/source:block group-focus-visible/source:block">
        <SourcePreviewCard source={source} />
      </span>
    </a>
  );
}

export function SourcesInlineStrip({
  sources,
  compact = false,
}: {
  sources: ChatSource[];
  compact?: boolean;
}) {
  if (sources.length === 0) return null;

  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", compact && "mt-1 gap-1")}>
      {sources.slice(0, compact ? 6 : 5).map((source, index) => (
        <SourceChip key={source.id} source={source} index={index} compact={compact} />
      ))}
    </div>
  );
}

function SourcePanelRow({ source, index }: { source: ChatSource; index: number }) {
  const excerpt =
    source.highlights?.find((highlight) => highlight.trim()) ?? source.snippet;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[12px] border border-zinc-200 bg-white/95 p-2.5 text-[13px] transition-colors hover:bg-zinc-50"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <SourceFavicon source={source} />
        <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">
          {source.domain}
        </span>
        <span className="rounded-full bg-zinc-100 px-1 py-px text-[10px] text-zinc-500">
          {index + 1}
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 font-semibold leading-5 text-zinc-900">
          {source.title || source.url}
        </p>
        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
      </div>
      {excerpt ? (
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-[1.35] text-zinc-600">
          {excerpt}
        </p>
      ) : null}
    </a>
  );
}

export function ChatSourcesPanel({
  onClose,
  messages,
  messageId,
}: {
  onClose: () => void;
  messages: Message[];
  messageId?: string | null;
}) {
  const sources = React.useMemo(() => {
    if (messageId) {
      const msg = messages.find((m) => m.id === messageId);
      return msg ? collectMessageSources(msg) : [];
    }
    return collectChatSources(messages);
  }, [messages, messageId]);

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-zinc-200 bg-white/95 backdrop-blur-md lg:w-[min(360px,34vw)] lg:shrink-0 lg:border-l">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <h3 className="text-[14px] font-medium text-zinc-800">
          Sources
          {sources.length > 0 ? (
            <span className="ml-1.5 text-zinc-400">({sources.length})</span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources panel"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        >
          <X className="icon-md" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {sources.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] leading-5 text-zinc-500">
              Web search sources will appear here once a search-backed answer
              runs.
            </p>
          ) : (
            sources.map((source, index) => (
              <SourcePanelRow key={source.id} source={source} index={index} />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
