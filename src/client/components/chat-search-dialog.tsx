"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchChatTitles, type ApiChat } from "@/lib/api/chats";
import { cn } from "@/lib/utils";

type SearchHit = {
  id: string;
  name: string;
  updatedAt?: string;
};

function recencyLabel(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = (Date.now() - then) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "Past week";
  if (days < 31) return "Past month";
  if (days < 365) return "Past year";
  return "Older";
}

export function ChatSearchDialog({
  open,
  onOpenChange,
  onSelectChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChat: (chat: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setActiveIndex(0);
      setLoading(false);
      return;
    }

    const current = ++requestId.current;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void searchChatTitles(query, query.trim() ? 40 : 80)
        .then((result) => {
          if (current !== requestId.current) return;
          setHits(
            (result.chats ?? []).map((chat: ApiChat) => ({
              id: chat.id,
              name: chat.name || "New chat",
              updatedAt: chat.updatedAt,
            })),
          );
          setActiveIndex(0);
        })
        .catch(() => {
          if (current !== requestId.current) return;
          setHits([]);
        })
        .finally(() => {
          if (current === requestId.current) setLoading(false);
        });
    }, query.trim() ? 180 : 0);

    return () => window.clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, hits.length]);

  const emptyLabel = useMemo(() => {
    if (loading) return "";
    return query.trim() ? "No chats found" : "No chats yet";
  }, [loading, query]);

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onOpenChange(false);
    onSelectChat({ id: hit.id, name: hit.name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-label="Search"
        className="chat-search-dialog !flex w-[min(672px,calc(100vw-2rem))] !max-w-[672px] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex shrink-0 items-center gap-2 px-6 pb-3.5 pr-2.5 pt-4">
          <Search
            className="-ml-1 size-5 shrink-0 text-[#898781]"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            aria-label="Search chats"
            placeholder="Search chats"
            value={query}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  hits.length ? (index + 1) % hits.length : 0,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) =>
                  hits.length ? (index - 1 + hits.length) % hits.length : 0,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(hits[activeIndex]);
              }
            }}
            className="min-w-0 flex-1 resize-none border-0 bg-transparent text-[14px] leading-5 text-[var(--ui-fg)] outline-none placeholder:text-[#898781]"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--ui-fg)]"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="h-px w-full bg-[rgba(11,11,11,0.1)]" />
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Search results"
          aria-busy={loading}
          className="max-h-[440px] overflow-y-auto px-2.5 py-2.5"
        >
          {loading ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, index) => (
                <div
                  key={index}
                  className="chat-search-skeleton flex h-9 items-center gap-2 rounded-lg px-3"
                >
                  <span className="size-5 shrink-0 rounded-md" />
                  <span className="h-3.5 flex-1 rounded-md" />
                  <span className="h-3 w-16 shrink-0 rounded-md" />
                </div>
              ))}
            </div>
          ) : hits.length ? (
            <div className="flex flex-col gap-1">
              {hits.map((hit, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={hit.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(hit)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg px-3 py-2 text-left text-[14px] leading-5 text-[#52514e] transition-colors",
                      active
                        ? "bg-[rgba(11,11,11,0.05)] text-[var(--ui-fg)]"
                        : "hover:bg-[rgba(11,11,11,0.05)]",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <MessageSquare
                        className="size-5 shrink-0"
                        strokeWidth={1.6}
                        aria-hidden
                      />
                      <span className="truncate">{hit.name}</span>
                    </span>
                    <span className="shrink-0 text-[12px] leading-4 text-[#898781]">
                      {recencyLabel(hit.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-8 text-center text-[13px] text-[#898781]">
              {emptyLabel}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-5 border-t border-[rgba(11,11,11,0.1)] px-5 py-2.5 text-[12px] leading-4 text-[#898781]">
          <span className="inline-flex items-center gap-2">
            Select
            <kbd className="chat-search-kbd">↑</kbd>
            <kbd className="chat-search-kbd">↓</kbd>
          </span>
          <span className="inline-flex items-center gap-2">
            Open
            <kbd className="chat-search-kbd">↩</kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
