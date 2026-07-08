"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Search, X } from "lucide-react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { collectChatSources, collectMessageSources, type ChatSource, normalizeUrl } from "@/frontend/lib/chat-sources";
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
    <div
      className={cn(
        "w-full rounded-[14px] border border-zinc-200 bg-white p-3 text-left",
        // Stronger presence so the card is clearly on top and not overlapped by nearby text or UI.
        "shadow-[0_14px_36px_-12px_rgba(24,24,27,0.22),0_3px_8px_-2px_rgba(24,24,27,0.12)] ring-1 ring-black/[0.04]",
      )}
    >
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

const SOURCE_PREVIEW_CARD_WIDTH = 320;
const SOURCE_PREVIEW_VIEWPORT_PADDING = 16;
const SOURCE_PREVIEW_CHIP_GAP = 8;

function clampPreviewLeft(anchorCenterX: number, cardWidth: number) {
  const maxLeft = window.innerWidth - cardWidth - SOURCE_PREVIEW_VIEWPORT_PADDING;
  const centered = anchorCenterX - cardWidth / 2;
  return Math.max(SOURCE_PREVIEW_VIEWPORT_PADDING, Math.min(centered, maxLeft));
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
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const unmountTimeoutRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const [cardWidth, setCardWidth] = useState(SOURCE_PREVIEW_CARD_WIDTH);

  const sizeClasses = compact
    ? "h-6 max-w-[160px] gap-1 rounded-full px-1.5 text-[11px]"
    : "h-7 max-w-[200px] gap-1.5 rounded-full px-2 text-[12px]";

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(
      SOURCE_PREVIEW_CARD_WIDTH,
      window.innerWidth - SOURCE_PREVIEW_VIEWPORT_PADDING * 2,
    );
    setCardWidth(width);
    setCoords({
      left: clampPreviewLeft(rect.left + rect.width / 2, width),
      top: rect.top - SOURCE_PREVIEW_CHIP_GAP,
    });
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current != null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (unmountTimeoutRef.current != null) {
      window.clearTimeout(unmountTimeoutRef.current);
      unmountTimeoutRef.current = null;
    }
  }, []);

  const showPreview = useCallback(() => {
    cancelHide();
    updatePosition();
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }, [cancelHide, updatePosition]);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      hideTimeoutRef.current = null;
      unmountTimeoutRef.current = window.setTimeout(() => {
        setMounted(false);
        unmountTimeoutRef.current = null;
      }, 180);
    }, 160);
  }, [cancelHide]);

  useEffect(() => {
    if (!open) return;
    const sync = () => updatePosition();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      if (unmountTimeoutRef.current != null) {
        window.clearTimeout(unmountTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <a
        ref={anchorRef}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={showPreview}
        onMouseLeave={scheduleHide}
        onFocus={showPreview}
        onBlur={scheduleHide}
        className={cn(
          "relative mx-0.5 inline-flex align-baseline items-center border border-zinc-200 bg-white font-medium text-zinc-700 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md",
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
      </a>

      {mounted && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed z-[180] pointer-events-auto will-change-[opacity,transform]",
                "origin-bottom transition-[opacity,transform] duration-200 ease-out",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{
                left: coords.left,
                top: coords.top,
                width: cardWidth,
                transform: `translateY(-100%) scale(${open ? 1 : 0.98})`,
              }}
              onMouseEnter={showPreview}
              onMouseLeave={scheduleHide}
            >
              <SourcePreviewCard source={source} />
              {/* Invisible bridge down to the chip so hover is not lost in the gap. */}
              <span className="block h-3 w-full" aria-hidden />
            </div>,
            document.body,
          )
        : null}
    </>
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

export function createCitationLink(sources: ChatSource[]) {
  const byUrl = new Map<string, { source: ChatSource; index: number }>();
  sources.forEach((s, i) => {
    byUrl.set(normalizeUrl(s.url), { source: s, index: i });
  });

  return function CitationLink({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string;
    children?: React.ReactNode;
  }) {
    if (href) {
      const hit = byUrl.get(normalizeUrl(href));
      if (hit) {
        return <SourceChip source={hit.source} compact />;
      }
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
}
