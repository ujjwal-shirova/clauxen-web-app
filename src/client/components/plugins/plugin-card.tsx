"use client";

import { Check } from "lucide-react";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

type PluginAddButtonProps = {
  added: boolean;
  name: string;
  onToggle: () => void;
};

export function PluginAddButton({ added, name, onToggle }: PluginAddButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={added}
      aria-label={added ? `Remove ${name}` : `Add ${name}`}
      onClick={onToggle}
      className={cn(
        appBtn.secondarySm,
        "plugin-add-button no-hover-overlay mt-0.5 min-w-[72px] px-2.5",
        added && "text-[var(--ui-fg-muted)]",
      )}
    >
      {added ? <Check className="size-3.5" strokeWidth={2} /> : null}
      {added ? "Added" : "Add"}
    </button>
  );
}

type PluginCardProps = {
  plugin: MarketplacePlugin;
  added: boolean;
  onOpen: (plugin: MarketplacePlugin) => void;
  onToggle: (id: string) => void;
};

export function PluginCard({ plugin, added, onOpen, onToggle }: PluginCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--ui-border)] bg-white p-3 transition-colors hover:bg-[var(--ui-hover-wash)]">
      <button
        type="button"
        onClick={() => onOpen(plugin)}
        className="no-hover-overlay flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
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
        </span>
      </button>
      <PluginAddButton
        added={added}
        name={plugin.name}
        onToggle={() => onToggle(plugin.id)}
      />
    </div>
  );
}
