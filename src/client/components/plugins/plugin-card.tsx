"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

/**
 * A marketplace card.
 * Clicking the card opens the plugin's pop-up container.
 * Clicking the "Add" button inside the card directly begins platform authorization.
 */
export type PluginCardProps = {
  plugin: MarketplacePlugin;
  connected?: boolean;
  isStarting?: boolean;
  onOpen: (plugin: MarketplacePlugin) => void;
  onAdd?: (plugin: MarketplacePlugin) => void;
  onPrefetch?: (plugin: MarketplacePlugin) => void;
};

export function PluginCard({
  plugin,
  connected = false,
  isStarting = false,
  onOpen,
  onAdd,
  onPrefetch,
}: PluginCardProps) {
  const name = stripCursorText(plugin.name) || plugin.name;
  const description = cardDescription(plugin.description);

  return (
    <div
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
      className="no-hover-overlay group flex h-[86px] w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white p-3 text-left outline-none transition-colors hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
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
              "h-7 gap-1 rounded-lg px-2.5 text-[12px] font-medium shadow-none transition-all hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] active:scale-95",
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
}
