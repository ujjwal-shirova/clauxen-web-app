"use client";

import React from "react";
import type { Message } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";

const MESSAGE_ANCHOR_PREFIX = "chat-message-";

export function messageAnchorId(messageId: string) {
  return `${MESSAGE_ANCHOR_PREFIX}${messageId}`;
}

function truncatePreview(text: string, max = 56) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
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

  return (
    <div
      className={cn(
        "pointer-events-none relative flex h-full w-full items-center justify-center",
        className,
      )}
      onMouseEnter={() => setIsRailHovered(true)}
      onMouseLeave={() => {
        setIsRailHovered(false);
        setHoveredId(null);
      }}
    >
      <div className="pointer-events-auto relative flex items-center">
        {showPreviewPanel ? (
          <div
            className="absolute right-[calc(100%+8px)] top-1/2 z-30 max-h-[376px] min-w-[240px] max-w-[320px] -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white py-1.5 shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)]"
            onMouseEnter={() => setIsRailHovered(true)}
          >
            <ul className="app-scrollbar flex max-h-[376px] flex-col overflow-y-auto overscroll-contain">
              {userMessages.map((message) => {
                const preview = truncatePreview(message.content);
                const isActive = previewActiveId === message.id;

                return (
                  <li key={message.id}>
                    <button
                      type="button"
                      onClick={() => scrollToMessage(message.id)}
                      onMouseEnter={() => setHoveredId(message.id)}
                      onMouseLeave={() => setHoveredId(null)}
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
          </div>
        ) : null}

        <div className="app-scrollbar flex max-h-[376px] w-full flex-col items-center gap-2 overflow-y-auto px-1 py-1">
          {userMessages.map((message) => {
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
                onMouseLeave={() => setHoveredId(null)}
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
