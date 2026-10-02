"use client";

import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PluginMark } from "./plugin-mark";
import type { PluginConnection } from "./use-plugin-connections";
import type { MarketplacePlugin } from "./types";

/**
 * The "Added" strip at the top of the Plugins page — a single horizontal line
 * of every plugin the user has connected, so they can see at a glance what is
 * on their account. Tapping one opens its details; the small × removes it.
 */
export type AddedPluginsRowProps = {
  connections: PluginConnection[];
  onOpen: (plugin: MarketplacePlugin) => void;
  onRemove: (connection: PluginConnection) => void;
};

export function AddedPluginsRow({
  connections,
  onOpen,
  onRemove,
}: AddedPluginsRowProps) {
  if (connections.length === 0) return null;

  return (
    <section
      aria-labelledby="added-plugins-heading"
      className="shrink-0 border-b border-[var(--ui-border-subtle)] px-4 pb-3 pt-4 sm:px-6"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <h2
          id="added-plugins-heading"
          className="text-[12.5px] font-medium leading-[18px] text-[var(--ui-fg-muted)]"
        >
          Added
        </h2>
        <span className="text-[12px] leading-[18px] text-[var(--ui-fg-placeholder)]">
          · {connections.length}
        </span>
      </div>

      {/* One horizontal line of connected plugin icons. */}
      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {connections.map((connection) => {
          const name = connection.pluginName || connection.pluginId;
          return (
            <div
              key={connection.id}
              className="group relative shrink-0"
            >
              <button
                type="button"
                onClick={() => onOpen(toMarketplacePlugin(connection))}
                title={name}
                aria-label={`Open ${name}`}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-white py-1 pl-1 pr-2.5",
                  "transition-colors hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
                  connection.status !== "active" && "opacity-70",
                )}
              >
                <PluginMark
                  name={name}
                  iconUrl={connection.pluginIconUrl ?? undefined}
                  size={26}
                  className="rounded-full"
                />
                <span className="max-w-[132px] truncate text-[12.5px] font-medium leading-[18px] text-[var(--ui-fg)]">
                  {name}
                </span>
                <ChevronRight
                  className="size-3 text-[var(--ui-fg-placeholder)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(connection);
                }}
                aria-label={`Remove ${name}`}
                className={cn(
                  "absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full",
                  "border border-[var(--ui-border)] bg-white text-[var(--ui-fg-muted)]",
                  "opacity-0 transition-opacity group-hover:opacity-100",
                  "hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
                  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
                )}
              >
                <X className="size-2.5" strokeWidth={2.25} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Connections are stored without marketplace metadata; this projects one into
 * the shape the detail dialog expects. Category/author are not persisted, so
 * they come back empty and the dialog simply omits that line.
 */
function toMarketplacePlugin(connection: PluginConnection): MarketplacePlugin {
  return {
    id: connection.pluginId,
    name: connection.pluginName || connection.pluginId,
    description: "",
    author: "",
    iconUrl: connection.pluginIconUrl ?? "",
    category: "",
    installed: true,
  };
}
