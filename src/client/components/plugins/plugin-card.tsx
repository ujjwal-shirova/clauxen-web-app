"use client";

import { ChevronRight } from "lucide-react";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

/**
 * A marketplace row. The whole card is the hit target — clicking it opens the
 * plugin's detail popup, which owns the "Add to Clauxen" action.
 */
type PluginCardProps = {
  plugin: MarketplacePlugin;
  onOpen: (plugin: MarketplacePlugin) => void;
  onPrefetch?: (plugin: MarketplacePlugin) => void;
};

export function PluginCard({ plugin, onOpen, onPrefetch }: PluginCardProps) {
  const name = stripCursorText(plugin.name) || plugin.name;
  const description = cardDescription(plugin.description);

  return (
    <button
      type="button"
      onClick={() => onOpen(plugin)}
      onMouseEnter={onPrefetch ? () => onPrefetch(plugin) : undefined}
      onFocus={onPrefetch ? () => onPrefetch(plugin) : undefined}
      className="no-hover-overlay flex h-[84px] w-full items-start gap-3 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white p-3 text-left outline-none transition-colors hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
    >
      <PluginMark name={name} iconUrl={plugin.iconUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]">
          {name}
        </span>
        {description ? (
          <span className="mt-0.5 block h-9 overflow-hidden text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <ChevronRight
        className="mt-1 size-3.5 shrink-0 text-[var(--ui-fg-placeholder)]"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
