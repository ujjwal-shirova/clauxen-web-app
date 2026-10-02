"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

type DiscoverRowProps = {
  plugins: MarketplacePlugin[];
  connectedIds?: Set<string>;
  startingId?: string | null;
  onOpen: (plugin: MarketplacePlugin) => void;
  onAdd?: (plugin: MarketplacePlugin) => void;
  onPrefetch?: (plugin: MarketplacePlugin) => void;
};

export function DiscoverRow({
  plugins,
  connectedIds,
  startingId,
  onOpen,
  onAdd,
  onPrefetch,
}: DiscoverRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [plugins, updateEdges]);

  const scrollByDir = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * 292, behavior: "smooth" });
  };

  if (!plugins.length) return null;

  return (
    <section className="mt-6" aria-labelledby="plugin-discover-heading">
      <h2
        id="plugin-discover-heading"
        className="mb-3 text-[15px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]"
      >
        Discover
      </h2>
      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={updateEdges}
          className="scrollbar-hide flex gap-2.5 overflow-x-auto scroll-smooth pb-1"
        >
          {plugins.map((plugin) => {
            const name = stripCursorText(plugin.name) || plugin.name;
            const description = cardDescription(plugin.description);
            const connected = connectedIds ? connectedIds.has(plugin.id) : false;
            const isStarting = startingId === plugin.id;

            return (
              <div
                key={plugin.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(plugin)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(plugin);
                  }
                }}
                onMouseEnter={onPrefetch ? () => onPrefetch(plugin) : undefined}
                onFocus={onPrefetch ? () => onPrefetch(plugin) : undefined}
                className="no-hover-overlay flex h-[86px] w-[276px] shrink-0 cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white p-3 text-left outline-none transition-colors hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
              >
                <PluginMark name={name} iconUrl={plugin.iconUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]">
                    {name}
                  </span>
                  {description ? (
                    <span className="mt-0.5 block h-9 overflow-hidden text-[12px] leading-[18px] text-[var(--ui-fg-muted)]">
                      {description}
                    </span>
                  ) : null}
                </span>

                <div className="flex shrink-0 items-center self-center pl-1">
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <Check className="size-3" strokeWidth={2.5} />
                      Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAdd?.(plugin);
                      }}
                      disabled={isStarting}
                      aria-label={`Add ${name} to Clauxen`}
                      className={cn(
                        appBtn.secondarySm,
                        "h-7 gap-1 rounded-lg px-2.5 text-[12px] font-medium shadow-none hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)]",
                        isStarting && "opacity-80",
                      )}
                    >
                      {isStarting ? (
                        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
                      ) : (
                        <Plus className="size-3" strokeWidth={2.2} />
                      )}
                      {isStarting ? "Adding…" : "Add"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollButton
          label="Scroll discover backward"
          hidden={!edges.left}
          className="left-0"
          onClick={() => scrollByDir(-1)}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </ScrollButton>
        <ScrollButton
          label="Scroll discover forward"
          hidden={!edges.right}
          className="right-0"
          onClick={() => scrollByDir(1)}
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </ScrollButton>
      </div>
    </section>
  );
}

function ScrollButton({
  label,
  hidden,
  className,
  onClick,
  children,
}: {
  label: string;
  hidden: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "ui-icon-button no-hover-overlay absolute top-1/2 z-10 !size-7 -translate-y-1/2 border border-[var(--ui-border)] bg-white shadow-[0_1px_2px_rgba(20,21,26,0.06)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
