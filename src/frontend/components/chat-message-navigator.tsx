"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Message } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";

const MESSAGE_ANCHOR_PREFIX = "chat-message-";
const HOVER_HIDE_DELAY_MS = 180;
const MAX_NAV_ITEMS = 14;

export function messageAnchorId(messageId: string) {
  return `${MESSAGE_ANCHOR_PREFIX}${messageId}`;
}

function truncatePreview(text: string, max = 56) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function visibleMessageWindow<T>(
  items: T[],
  activeIndex: number,
  maxItems = MAX_NAV_ITEMS,
) {
  if (items.length <= maxItems) {
    return { start: 0, items };
  }

  const safeActiveIndex =
    activeIndex >= 0 ? activeIndex : Math.min(items.length - 1, 0);
  const radius = Math.floor(maxItems / 2);
  const start = Math.min(
    Math.max(0, safeActiveIndex - radius),
    Math.max(0, items.length - maxItems),
  );

  return {
    start,
    items: items.slice(start, start + maxItems),
  };
}

type ChatMessageNavigatorProps = {
  messages: Message[];
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
};

function ChatMessageNavigatorInner({
  messages,
  scrollAreaRef,
  className,
}: ChatMessageNavigatorProps) {
  const userMessages = React.useMemo(
    () => messages.filter((message) => message.role === "user"),
    [messages],
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isRailHovered, setIsRailHovered] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearHideTimeout = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const openRail = React.useCallback(() => {
    clearHideTimeout();
    setIsRailHovered(true);
  }, [clearHideTimeout]);

  const scheduleCloseRail = React.useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setIsRailHovered(false);
      setHoveredId(null);
    }, HOVER_HIDE_DELAY_MS);
  }, [clearHideTimeout]);

  React.useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const getViewport = React.useCallback(() => {
    const root = scrollAreaRef.current;
    if (!root) return null;
    return root.querySelector<HTMLDivElement>(
      "div[data-radix-scroll-area-viewport]",
    );
  }, [scrollAreaRef]);

  React.useEffect(() => {
    if (userMessages.length === 0) {
      setActiveId(null);
      return;
    }

    const viewport = getViewport();
    if (!viewport) return;

    const elements = userMessages
      .map((message) => document.getElementById(messageAnchorId(message.id)))
      .filter((node): node is HTMLElement => node !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const id = visible[0].target.id.replace(MESSAGE_ANCHOR_PREFIX, "");
          setActiveId(id);
          return;
        }

        const viewportTop = viewport.getBoundingClientRect().top;
        let closestId: string | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (const element of elements) {
          const distance = Math.abs(
            element.getBoundingClientRect().top - viewportTop - 80,
          );
          if (distance < closestDistance) {
            closestDistance = distance;
            closestId = element.id.replace(MESSAGE_ANCHOR_PREFIX, "");
          }
        }

        if (closestId) setActiveId(closestId);
      },
      {
        root: viewport,
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.15, 0.4, 0.75, 1],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [getViewport, userMessages]);

  const scrollToMessage = React.useCallback(
    (messageId: string) => {
      const viewport = getViewport();
      const target = document.getElementById(messageAnchorId(messageId));
      if (!viewport || !target) return;

      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop =
        viewport.scrollTop + (targetRect.top - viewportRect.top) - 72;

      viewport.scrollTo({
        top: Math.max(0, nextTop),
        behavior: "smooth",
      });
      setActiveId(messageId);
    },
    [getViewport],
  );

  if (userMessages.length === 0) {
    return null;
  }

  const showPreviewPanel = isRailHovered || hoveredId !== null;
  const previewActiveId = hoveredId ?? activeId;
  const activeIndex = React.useMemo(() => {
    const id = activeId;
    if (!id) return 0;
    const index = userMessages.findIndex((message) => message.id === id);
    return index >= 0 ? index : 0;
  }, [activeId, userMessages]);
  const visibleWindow = React.useMemo(
    () => visibleMessageWindow(userMessages, activeIndex),
    [activeIndex, userMessages],
  );
  const visibleMessages = visibleWindow.items;
  const canPageBackward = visibleWindow.start > 0;
  const canPageForward =
    visibleWindow.start + visibleMessages.length < userMessages.length;
  const canStepBackward = activeIndex > 0;
  const canStepForward = activeIndex < userMessages.length - 1;
  const activePosition = Math.min(
    userMessages.length,
    Math.max(1, activeIndex + 1),
  );

  const stepNavigator = React.useCallback(
    (direction: 1 | -1) => {
      if (userMessages.length === 0) return;
      const nextIndex = Math.min(
        userMessages.length - 1,
        Math.max(0, activeIndex + direction),
      );
      const next = userMessages[nextIndex];
      if (next) scrollToMessage(next.id);
    },
    [activeIndex, scrollToMessage, userMessages],
  );

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center",
        className,
      )}
    >
      <div
        className="relative flex items-center"
        onMouseEnter={openRail}
        onMouseLeave={scheduleCloseRail}
        onWheel={(event) => {
          if (userMessages.length <= 1) return;
          event.preventDefault();
          stepNavigator(event.deltaY > 0 ? 1 : -1);
        }}
      >
        {showPreviewPanel ? (
          <div
            data-message-navigator-popup
            className="absolute right-full top-1/2 z-30 min-w-[240px] max-w-[320px] -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white py-1.5 shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)]"
            onMouseEnter={openRail}
            onWheel={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-zinc-400">
              <span>
                {activePosition} / {userMessages.length}
              </span>
              <span>Use arrows or wheel</span>
            </div>
            <button
              type="button"
              aria-label="Previous message"
              disabled={!canStepBackward}
              onClick={() => stepNavigator(-1)}
              className={cn(
                "mx-1.5 mb-1 flex h-7 w-[calc(100%-12px)] items-center justify-center rounded-lg text-zinc-400 transition-colors",
                canStepBackward
                  ? "hover:bg-zinc-100 hover:text-zinc-700"
                  : "cursor-default opacity-35",
              )}
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2} />
            </button>
            <ul className="app-scrollbar flex max-h-[276px] flex-col overflow-y-auto overscroll-contain">
              {visibleMessages.map((message) => {
                const preview = truncatePreview(message.content);
                const isActive = previewActiveId === message.id;

                return (
                  <li key={message.id}>
                    <button
                      type="button"
                      onClick={() => scrollToMessage(message.id)}
                      onMouseEnter={() => setHoveredId(message.id)}
                      className={cn(
                        "mx-1.5 flex min-h-9 w-[calc(100%-12px)] max-w-[calc(100%-12px)] items-center rounded-[10px] px-2.5 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors",
                        isActive ? "bg-black/[0.06]" : "hover:bg-black/[0.04]",
                      )}
                    >
                      <span className="truncate" title={message.content}>
                        {preview}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              aria-label="Next message"
              disabled={!canStepForward}
              onClick={() => stepNavigator(1)}
              className={cn(
                "mx-1.5 mt-1 flex h-7 w-[calc(100%-12px)] items-center justify-center rounded-lg text-zinc-400 transition-colors",
                canStepForward
                  ? "hover:bg-zinc-100 hover:text-zinc-700"
                  : "cursor-default opacity-35",
              )}
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}

        <div className="flex max-h-[320px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden px-1 py-1 pl-2">
          {visibleMessages.map((message) => {
            const isActive = activeId === message.id;
            const preview = truncatePreview(message.content);

            return (
              <button
                key={message.id}
                type="button"
                aria-label={preview}
                aria-current={isActive ? "true" : undefined}
                onClick={() => scrollToMessage(message.id)}
                onMouseEnter={() => setHoveredId(message.id)}
                className={cn(
                  "h-0.5 w-[18px] shrink-0 rounded-full transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isActive
                    ? "bg-[#0d0d0d]"
                    : "bg-zinc-300/60 hover:bg-zinc-500",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function sameUserMessages(previous: Message[], next: Message[]) {
  const previousUsers = previous.filter((message) => message.role === "user");
  const nextUsers = next.filter((message) => message.role === "user");

  return (
    previousUsers.length === nextUsers.length &&
    previousUsers.every(
      (message, index) =>
        message.id === nextUsers[index]?.id &&
        message.content === nextUsers[index]?.content,
    )
  );
}

export const ChatMessageNavigator = React.memo(
  ChatMessageNavigatorInner,
  (previous, next) =>
    previous.scrollAreaRef === next.scrollAreaRef &&
    previous.className === next.className &&
    sameUserMessages(previous.messages, next.messages),
);
