"use client";

import { ArrowUpRight, Check, Loader2, Plug } from "lucide-react";
import Link from "next/link";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

/**
 * The plugin popover shown when a marketplace card is clicked.
 *
 * Layout: the plugin icon leads, with its name and description stacked to the
 * right of it, then the two actions underneath — "Add to Clauxen" (which opens
 * the connect confirmation) and "Try it in chat".
 */
export type PluginDetailDialogProps = {
  plugin: MarketplacePlugin | null;
  /** True when this plugin already has a connection on the account. */
  connected: boolean;
  /** True while the connect confirmation is being prepared. */
  starting: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (plugin: MarketplacePlugin) => void;
};

export function PluginDetailDialog({
  plugin,
  connected,
  starting,
  onOpenChange,
  onAdd,
}: PluginDetailDialogProps) {
  const name = plugin ? stripCursorText(plugin.name) || plugin.name : "";
  const description = plugin ? stripCursorText(plugin.description) : "";
  const category = plugin ? stripCursorText(plugin.category) : "";

  return (
    <Dialog open={plugin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="plugin-marketplace max-w-[440px] gap-0 p-0">
        {plugin ? (
          <>
            <DialogHeader className="gap-0 space-y-0 p-5 pb-4">
              {/* Icon leads, with name + description stacked to its right. */}
              <div className="flex items-start gap-3.5">
                <PluginMark name={name} iconUrl={plugin.iconUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[16px] font-semibold leading-6 tracking-[-0.01em]">
                    {name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 line-clamp-4 text-[13px] leading-[19px] text-[var(--ui-fg-body)]">
                    {description || "No description for this plugin yet."}
                  </DialogDescription>
                </div>
              </div>

              {category ? (
                <p className="mt-3 text-[12px] leading-[17px] text-[var(--ui-fg-placeholder)]">
                  {category}
                  {stripCursorText(plugin.author)
                    ? ` · ${stripCursorText(plugin.author)}`
                    : ""}
                </p>
              ) : null}
            </DialogHeader>

            <div className="flex flex-col gap-2 border-t border-[var(--ui-border-subtle)] p-4">
              <button
                type="button"
                onClick={() => onAdd(plugin)}
                disabled={starting}
                className={cn(
                  appBtn.primary,
                  "h-10 w-full justify-center gap-2 px-4 text-[13.5px]",
                )}
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : connected ? (
                  <Check className="size-4" strokeWidth={2} />
                ) : (
                  <Plug className="size-4" strokeWidth={1.9} />
                )}
                {connected ? "Manage connection" : "Add to Clauxen"}
              </button>

              <Link
                href="/new"
                onClick={() => onOpenChange(false)}
                className={cn(
                  appBtn.secondary,
                  "h-10 w-full justify-center gap-1.5 px-4 text-[13.5px]",
                )}
              >
                Try it in chat
                <ArrowUpRight className="size-3.5" strokeWidth={1.9} />
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
