"use client";

import { Check, Loader2, Plug } from "lucide-react";
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
 * The plugin pop-up container shown when clicking any plugin in the marketplace.
 *
 * Container layout:
 * - Plugin icon at the top
 * - Plugin name
 * - Plugin description
 * - "Add to Clauxen" button (directly launches new-tab platform authorization)
 */
export type PluginDetailDialogProps = {
  plugin: MarketplacePlugin | null;
  /** True when this plugin already has an active connection on the account. */
  connected: boolean;
  /** True while the platform authorization is being started. */
  starting: boolean;
  /** Optional error message from authorization start. */
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (plugin: MarketplacePlugin) => void;
  onRemove?: (pluginId: string) => void;
};

export function PluginDetailDialog({
  plugin,
  connected,
  starting,
  error,
  onOpenChange,
  onAdd,
}: PluginDetailDialogProps) {
  const name = plugin ? stripCursorText(plugin.name) || plugin.name : "";
  const description = plugin ? stripCursorText(plugin.description) : "";
  const category = plugin ? stripCursorText(plugin.category) : "";
  const author = plugin ? stripCursorText(plugin.author) : "";

  return (
    <Dialog open={plugin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="plugin-marketplace max-w-[420px] gap-0 overflow-hidden rounded-2xl p-0">
        {plugin ? (
          <>
            <DialogHeader className="flex flex-col items-center gap-0 space-y-0 px-6 pt-7 pb-4 text-center">
              {/* Plugin icon at the top */}
              <div className="flex justify-center">
                <PluginMark
                  name={name}
                  iconUrl={plugin.iconUrl}
                  size={64}
                  className="rounded-2xl border border-[var(--ui-border)] shadow-sm"
                />
              </div>

              {/* Plugin name */}
              <DialogTitle className="mt-4 text-[18px] font-semibold leading-6 tracking-[-0.01em] text-[var(--ui-fg)]">
                {name}
              </DialogTitle>

              {/* Author & category metadata */}
              {category || author ? (
                <p className="mt-1 text-[12px] leading-4 text-[var(--ui-fg-placeholder)]">
                  {category}
                  {category && author ? " · " : ""}
                  {author}
                </p>
              ) : null}

              {/* Plugin description */}
              <DialogDescription className="mt-3.5 max-h-[160px] overflow-y-auto px-1 text-[13px] leading-[20px] text-[var(--ui-fg-body)]">
                {description || "No description provided for this plugin."}
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p
                role="alert"
                className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-[12px] leading-[17px] text-red-700"
              >
                {error}
              </p>
            ) : null}

            {/* Container Action Button: "Add to Clauxen" */}
            <div className="border-t border-[var(--ui-border-subtle)] bg-[var(--ui-subtle-surface,#fafafa)] p-5">
              <button
                type="button"
                onClick={() => onAdd(plugin)}
                disabled={starting}
                className={cn(
                  appBtn.primary,
                  "h-10 w-full justify-center gap-2 px-4 text-[13.5px] font-medium shadow-sm transition-all active:scale-[0.99]",
                  starting && "opacity-85",
                )}
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : connected ? (
                  <Check className="size-4 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Plug className="size-4" strokeWidth={2} />
                )}
                {starting
                  ? "Authorizing…"
                  : connected
                    ? "Reconnect with platform"
                    : "Add to Clauxen"}
              </button>

              {connected ? (
                <p className="mt-2 text-center text-[11.5px] text-emerald-700">
                  ✓ Plugin is connected and ready to use in chats.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
