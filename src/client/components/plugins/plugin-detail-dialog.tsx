"use client";

import React from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Plug,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
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
  onRemove,
}: PluginDetailDialogProps) {
  const name = plugin ? stripCursorText(plugin.name) || plugin.name : "";
  const description = plugin ? stripCursorText(plugin.description) : "";
  const category = plugin ? stripCursorText(plugin.category) : "";
  const author = plugin ? stripCursorText(plugin.author) : "";

  return (
    <Dialog open={plugin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden rounded-2xl p-0 border border-[var(--ui-border)] shadow-xl bg-[var(--ui-card-bg)]">
        {plugin ? (
          <div>
            {/* Modal Header */}
            <DialogHeader className="flex flex-col items-center px-6 pt-7 pb-4 text-center">
              {/* Plugin Artwork */}
              <div className="flex justify-center">
                <PluginMark
                  name={name}
                  iconUrl={plugin.iconUrl}
                  size={58}
                  className="rounded-2xl border border-[var(--ui-border)] shadow-xs"
                />
              </div>

              {/* Title & Status */}
              <DialogTitle className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[var(--ui-fg)]">
                {name}
              </DialogTitle>

              {/* Category & Publisher info */}
              <div className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-[var(--ui-fg-placeholder)]">
                {category ? (
                  <span className="font-medium text-[var(--ui-fg-muted)]">
                    {category}
                  </span>
                ) : null}
                {category && author ? <span>·</span> : null}
                {author ? <span>by {author}</span> : null}
              </div>

              {/* Description */}
              <DialogDescription className="mt-3.5 max-h-[140px] overflow-y-auto px-1 text-[13px] leading-[20px] text-[var(--ui-fg-muted)]">
                {description ||
                  `Connect ${name} to enable automated queries, workflows, and integrations with your Clauxen workspace.`}
              </DialogDescription>
            </DialogHeader>

            {/* Permissions / Features Box */}
            <div className="mx-6 mb-4 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-muted-surface)] p-3 text-left">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--ui-fg-subtle)]">
                Capabilities
              </span>
              <ul className="mt-1.5 space-y-1.5 text-[12px] text-[var(--ui-fg-muted)]">
                <li className="flex items-center gap-2">
                  <Zap className="size-3.5 shrink-0 text-amber-500" />
                  <span>Autonomous tool access in conversational agent sessions</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" />
                  <span>Encrypted credential storage via OAuth 2.0 handshake</span>
                </li>
              </ul>
            </div>

            {/* Error Message */}
            {error ? (
              <div
                role="alert"
                className="mx-6 mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-[12px] leading-[17px] text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </div>
            ) : null}

            {/* Footer Action Bar */}
            <div className="border-t border-[var(--ui-border-subtle)] bg-[var(--ui-subtle-surface,#fafafa)] p-5">
              <button
                type="button"
                onClick={() => onAdd(plugin)}
                disabled={starting}
                className={cn(
                  appBtn.primary,
                  "h-10 w-full justify-center gap-2 rounded-xl text-[13px] font-medium shadow-sm transition-all active:scale-[0.99]",
                  starting && "opacity-85 pointer-events-none",
                )}
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : connected ? (
                  <Check className="size-4 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Plug className="size-4" strokeWidth={2} />
                )}
                <span>
                  {starting
                    ? "Opening provider authorization…"
                    : connected
                      ? "Reconnect with Provider"
                      : `Add ${name} to Clauxen`}
                </span>
              </button>

              {connected ? (
                <div className="mt-3 flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected & active
                  </span>

                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(plugin.id)}
                      className="inline-flex items-center gap-1 text-[var(--ui-fg-muted)] hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3" />
                      <span>Disconnect</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-center text-[11px] text-[var(--ui-fg-placeholder)]">
                  Opens a new tab to authenticate securely with {name}.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
