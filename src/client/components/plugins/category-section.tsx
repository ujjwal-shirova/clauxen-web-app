"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PluginCard } from "./plugin-card";
import type { MarketplacePlugin } from "./types";

/** Cards shown per grid column before the "Show N more" label (5 × 2 cols). */
const VISIBLE_PER_COLUMN = 5;

/** Matches the \`sm:grid-cols-2\` breakpoint used by the card grid. */
const TWO_COLUMN_MQ = "(min-width: 640px)";

function subscribeTwoColumn(callback: () => void) {
  const mql = window.matchMedia(TWO_COLUMN_MQ);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTwoColumnSnapshot() {
  return window.matchMedia(TWO_COLUMN_MQ).matches;
}

function getTwoColumnServerSnapshot() {
  return false;
}

type CategorySectionProps = {
  title: string;
  plugins: MarketplacePlugin[];
  connectedIds?: Set<string>;
  startingId?: string | null;
  onOpen: (plugin: MarketplacePlugin) => void;
  onAdd?: (plugin: MarketplacePlugin) => void;
  onPrefetch?: (plugin: MarketplacePlugin) => void;
  className?: string;
  /** Skip the cap (e.g. while the user is searching). */
  defaultExpanded?: boolean;
};

export function CategorySection({
  title,
  plugins,
  connectedIds,
  startingId,
  onOpen,
  onAdd,
  onPrefetch,
  className,
  defaultExpanded = false,
}: CategorySectionProps) {
  const isTwoColumn = useSyncExternalStore(
    subscribeTwoColumn,
    getTwoColumnSnapshot,
    getTwoColumnServerSnapshot,
  );
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (!plugins.length) return null;

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const visibleCount = VISIBLE_PER_COLUMN * (isTwoColumn ? 2 : 1);
  const hidden = Math.max(0, plugins.length - visibleCount);
  const visiblePlugins = expanded ? plugins : plugins.slice(0, visibleCount);

  return (
    <section
      className={cn("mt-8", className)}
      aria-labelledby={`plugin-section-${slug}`}
    >
      <h2
        id={`plugin-section-${slug}`}
        className="mb-3 flex items-baseline gap-1.5 text-[15px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]"
      >
        {title}
        <span className="text-[12.5px] font-normal text-[var(--ui-fg-placeholder)]">
          · {plugins.length}
        </span>
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visiblePlugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            connected={connectedIds?.has(plugin.id)}
            isStarting={startingId === plugin.id}
            onOpen={onOpen}
            onAdd={onAdd}
            onPrefetch={onPrefetch}
          />
        ))}
      </div>
      {plugins.length > visibleCount ? (
        <div className="mt-1.5 flex justify-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5",
              "text-[12.5px] font-medium leading-[18px] text-[var(--ui-fg-muted)]",
              "transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
            )}
          >
            {expanded ? "Show less" : `Show ${hidden} more`}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180",
              )}
              strokeWidth={1.75}
            />
          </button>
        </div>
      ) : null}
    </section>
  );
}
