"use client";

import { useState } from "react";
import { ExternalLink, Loader2, ShieldCheck, Wrench } from "lucide-react";
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
 * The "add this to your platform" confirmation.
 *
 * Shown before any authorization starts, so the user sees exactly what they
 * are about to grant. Confirming opens the plugin's own authorization page in
 * a new tab (MCP OAuth 2.1, full-scope consent), where the provider asks for
 * every permission it supports — the user approves each one there.
 */
export type AddPluginDialogProps = {
  plugin: MarketplacePlugin | null;
  /** Remote MCP endpoint this connection will talk to, when resolved. */
  mcpUrl: string | null;
  /** True when the plugin already has a connection on the account. */
  connected: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (plugin: MarketplacePlugin) => void;
};

export function AddPluginDialog({
  plugin,
  mcpUrl,
  connected,
  error,
  onOpenChange,
  onConfirm,
}: AddPluginDialogProps) {
  const [pending, setPending] = useState(false);
  const name = plugin ? stripCursorText(plugin.name) || plugin.name : "";

  const confirm = () => {
    if (!plugin) return;
    setPending(true);
    onConfirm(plugin);
    // The dialog stays open if the request fails; the parent clears `plugin`
    // on success because the new authorization tab takes over.
  };

  return (
    <Dialog open={plugin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="plugin-marketplace max-w-[440px] gap-0 p-0">
        {plugin ? (
          <>
            <DialogHeader className="gap-0 space-y-0 p-5 pb-4">
              <div className="flex items-start gap-3.5">
                <PluginMark name={name} iconUrl={plugin.iconUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[15px] font-semibold leading-[22px] tracking-[-0.01em]">
                    {connected
                      ? `Manage ${name}`
                      : `Add ${name} to Clauxen?`}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-[13px] leading-[19px] text-[var(--ui-fg-body)]">
                    {connected
                      ? "This plugin is already connected. You can reconnect it to refresh its permissions, or remove it from your account."
                      : "Clauxen will ask for permission to use this plugin's tools in your chats."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 border-t border-[var(--ui-border-subtle)] px-5 py-4">
              <PermissionLine
                icon={ShieldCheck}
                title="You approve every permission"
                body="A new tab opens on the plugin's own authorization page. Nothing is shared until you approve it there."
              />
              <PermissionLine
                icon={Wrench}
                title="Used only while chatting"
                body="The assistant can call this plugin's tools in your conversations, and each call shows up in the activity trace."
              />
              {mcpUrl ? (
                <p className="mt-0.5 truncate text-[11.5px] leading-[16px] text-[var(--ui-fg-placeholder)]">
                  Connects to <span className="font-medium">{mcpUrl}</span>
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="mx-5 mb-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-[17px] text-red-700"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-[var(--ui-border-subtle)] p-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={cn(appBtn.secondarySm, "h-9 px-3")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className={cn(
                  appBtn.primarySm,
                  "h-9 gap-1.5 px-3.5",
                  pending && "opacity-80",
                )}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <ExternalLink className="size-3.5" strokeWidth={2} />
                )}
                {pending
                  ? "Opening…"
                  : connected
                    ? "Reconnect"
                    : "Continue to authorize"}
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PermissionLine({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
        <Icon className="size-3.5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium leading-[17px] text-[var(--ui-fg)]">
          {title}
        </p>
        <p className="text-[12px] leading-[17px] text-[var(--ui-fg-muted)]">
          {body}
        </p>
      </div>
    </div>
  );
}
