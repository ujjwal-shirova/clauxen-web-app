"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collectChatSources, collectMessageSources, type ChatSource, normalizeUrl } from "@/lib/chat-sources";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

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
      className={cn(
        "h-3.5 w-3.5 shrink-0 rounded-[3px] border border-zinc-200/80 bg-white object-cover",
        className,
      )}
    />
  );
}

export function SourcePreviewCard({ source }: { source: ChatSource }) {
  const excerpt =
    source.highlights?.find((highlight) => highlight.trim()) ?? source.snippet;

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-zinc-200/90 bg-white p-2.5 text-left",
        "shadow-[0_8px_24px_-10px_rgba(24,24,27,0.18),0_2px_6px_-2px_rgba(24,24,27,0.08)]",
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
  const showTimeoutRef = useRef<number | null>(null);
  const unmountTimeoutRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const [cardWidth, setCardWidth] = useState(SOURCE_PREVIEW_CARD_WIDTH);

  const sizeClasses = compact
    ? "h-5 max-w-[148px] gap-1 rounded-md px-1.5 text-[11px]"
    : "h-6 max-w-[180px] gap-1 rounded-md px-1.5 text-[11px]";

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

  const cancelShow = useCallback(() => {
    if (showTimeoutRef.current != null) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  const revealPreview = useCallback(() => {
    cancelHide();
    updatePosition();
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }, [cancelHide, updatePosition]);

  /** Delay before the preview container appears — avoids flash on quick passes. */
  const scheduleShow = useCallback(() => {
    cancelHide();
    cancelShow();
    if (mounted || open) {
      revealPreview();
      return;
    }
    showTimeoutRef.current = window.setTimeout(() => {
      showTimeoutRef.current = null;
      revealPreview();
    }, 280);
  }, [cancelHide, cancelShow, mounted, open, revealPreview]);

  const scheduleHide = useCallback(() => {
    cancelShow();
    cancelHide();
    hideTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      hideTimeoutRef.current = null;
      unmountTimeoutRef.current = window.setTimeout(() => {
        setMounted(false);
        unmountTimeoutRef.current = null;
      }, 180);
    }, 160);
  }, [cancelHide, cancelShow]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const sync = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updatePosition();
      });
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      if (showTimeoutRef.current != null) {
        window.clearTimeout(showTimeoutRef.current);
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
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        className={cn(
          "relative mx-0.5 inline-flex align-middle items-center border border-zinc-200/90 bg-white font-medium text-zinc-700 outline-none transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:border-zinc-300 focus-visible:ring-0 overflow-anchor-none",
          sizeClasses,
        )}
        data-source-chip=""
        data-chat-scroll-passthrough=""
      >
        <SourceFavicon
          source={source}
          className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"}
        />
        <span className="truncate leading-none">{source.domain}</span>
        {index != null ? (
          <span className="text-[10px] tabular-nums text-zinc-400">{index + 1}</span>
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
              data-source-preview=""
              data-chat-scroll-passthrough=""
              onMouseEnter={scheduleShow}
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
  // Intentionally unused for auto bottom groups — keep export for any
  // explicit caller. Prefer inline citation chips in markdown only.
  if (sources.length === 0) return null;

  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-1 overflow-anchor-none", compact && "mt-1")}>
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
      className="block rounded-lg border border-zinc-200/90 bg-white p-2.5 text-[13px] transition-colors hover:bg-zinc-50"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <SourceFavicon source={source} className="h-4 w-4 rounded-[3px]" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-700">
          {source.domain}
        </span>
        <span className="tabular-nums text-[11px] text-zinc-400">
          {index + 1}
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-zinc-900">
          {source.title || source.url}
        </p>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </div>
      {excerpt ? (
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-[1.4] text-zinc-500">
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
    <aside className="flex h-full w-full min-w-0 flex-col border-zinc-200/80 bg-[#f8f8f8] lg:w-[min(340px,34vw)] lg:shrink-0 lg:border-l">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 bg-[#f8f8f8] px-3 py-2.5">
        <h3 className="text-[13px] font-medium tracking-[-0.01em] text-zinc-800">
          Sources
          {sources.length > 0 ? (
            <span className="ml-1 text-zinc-400">({sources.length})</span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources panel"
          className="ui-icon-button text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 p-2.5">
          {sources.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] leading-5 text-zinc-500">
              Sources cited in answers will appear here.
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
        return (
          <span className="inline-flex overflow-anchor-none align-middle">
            <SourceChip source={hit.source} index={hit.index} compact />
          </span>
        );
      }
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
}
