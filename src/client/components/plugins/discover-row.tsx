"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

type DiscoverRowProps = {
  plugins: MarketplacePlugin[];
  onOpen: (plugin: MarketplacePlugin) => void;
};

export function DiscoverRow({ plugins, onOpen }: DiscoverRowProps) {
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
          {plugins.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              onClick={() => onOpen(plugin)}
              className="no-hover-overlay flex w-[272px] shrink-0 items-start gap-3 rounded-xl border border-[var(--ui-border)] bg-white p-3 text-left outline-none transition-colors hover:bg-[var(--ui-hover-wash)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              <PluginMark name={plugin.name} iconUrl={plugin.iconUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]">
                  {plugin.name}
                </span>
                {plugin.description ? (
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
                    {plugin.description}
                  </span>
                ) : null}
                {plugin.author ? (
                  <span className="mt-1.5 block truncate text-[12px] leading-4 text-[var(--ui-fg-subtle)]">
                    {plugin.author}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
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
