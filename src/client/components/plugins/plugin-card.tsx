"use client";

import React from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

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
  const description = cardDescription(plugin.description, 110);
  const author = stripCursorText(plugin.author);
  const category = stripCursorText(plugin.category);

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
      className={cn(
        "group relative flex min-h-[136px] w-full flex-col justify-between rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-3.5 text-left outline-none transition-all duration-150 cursor-pointer",
        "hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] hover:shadow-xs",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand-ring,#14151a)]",
      )}
    >
      {/* Top row: Icon, Name & Category */}
      <div className="flex items-start gap-3">
        <PluginMark
          name={name}
          iconUrl={plugin.iconUrl}
          size={36}
          className="rounded-lg border border-[var(--ui-border-subtle)] shrink-0 transition-transform group-hover:scale-105"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--ui-fg)] group-hover:text-[var(--brand-accent,#000)]">
              {name}
            </h3>
            {category ? (
              <span className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-[var(--ui-border-subtle)] bg-[var(--ui-muted-surface)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--ui-fg-subtle)]">
                {category}
              </span>
            ) : null}
          </div>

          {author ? (
            <p className="mt-0.5 truncate text-[11px] text-[var(--ui-fg-placeholder)]">
              by {author}
            </p>
          ) : null}
        </div>
      </div>

      {/* Description */}
      <p className="mt-2.5 line-clamp-2 text-[12px] leading-[18px] text-[var(--ui-fg-muted)]">
        {description || "Connect with Clauxen to automate tasks and workflows."}
      </p>

      {/* Bottom Footer: Meta & Action Button */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--ui-border-subtle)] pt-2.5">
        <span className="text-[11px] text-[var(--ui-fg-placeholder)]">
          {connected ? "Installed on workspace" : "OAuth Integration"}
        </span>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Check className="size-3" strokeWidth={2.5} />
              Connected
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onAdd?.(plugin)}
              disabled={isStarting}
              aria-label={`Connect ${name}`}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] px-2.5 text-[12px] font-medium text-[var(--ui-fg)] shadow-2xs transition-all",
                "hover:border-[var(--ui-fg)] hover:bg-[var(--ui-fg)] hover:text-[var(--app-panel-bg)] active:scale-95",
                isStarting && "opacity-80 pointer-events-none",
              )}
            >
              {isStarting ? (
                <Loader2 className="size-3 animate-spin" strokeWidth={2} />
              ) : (
                <Plus className="size-3" strokeWidth={2.2} />
              )}
              <span>{isStarting ? "Connecting…" : "Connect"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
