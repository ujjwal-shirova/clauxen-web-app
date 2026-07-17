"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Globe, Link2, Loader2, Lock, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { cn } from "@/frontend/lib/utils";
import * as shareApi from "@/frontend/lib/api/share";

type ShareMode = "private" | "link";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string | null;
}

export function ShareDialog({ isOpen, onClose, chatId }: ShareDialogProps) {
  const [mode, setMode] = useState<ShareMode>("private");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !chatId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopied(false);
    void (async () => {
      try {
        const state = await shareApi.getChatShare(chatId);
        if (cancelled) return;
        const url = state.shareUrl ?? null;
        setShareUrl(url);
        setMode(url ? "link" : "private");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load share settings.",
        );
        setShareUrl(null);
        setMode("private");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, chatId]);

  const handleSelectPrivate = async () => {
    if (!chatId || busy) return;
    if (mode === "private" && !shareUrl) return;
    setBusy(true);
    setError(null);
    try {
      await shareApi.createChatShare(chatId, { revoke: true });
      setShareUrl(null);
      setMode("private");
      setCopied(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not make chat private.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSelectLink = async () => {
    if (!chatId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const state = await shareApi.createChatShare(chatId, {
        visibility: "link",
      });
      setShareUrl(state.shareUrl);
      setMode("link");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create share link.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      const parsed = new URL(shareUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border border-zinc-200/90 bg-[#F7F7F4] p-0 shadow-[0_24px_64px_rgba(24,24,27,0.18)]",
          "w-[calc(100vw-1.5rem)] max-w-[420px] rounded-2xl",
          "max-h-[min(560px,calc(100vh-2rem))]",
          "[&>button]:hidden",
        )}
      >
        <DialogHeader className="flex flex-row items-start justify-between space-y-0 border-b border-zinc-200/80 px-5 py-4 text-left">
          <div className="min-w-0 pr-3">
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em] text-zinc-900">
              Share chat
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-snug text-zinc-500">
              {shareUrl
                ? "Anyone with the link can view this conversation up to now."
                : "Create a link to share a read-only snapshot of this chat."}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-4">
          {!chatId ? (
            <p className="text-[13px] text-zinc-500">
              Send a message first to share this chat.
            </p>
          ) : loading ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading share settings…
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSelectPrivate()}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                    "hover:bg-zinc-50 disabled:opacity-60",
                    mode === "private" && "bg-zinc-50",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-zinc-900">
                      Keep private
                    </span>
                    <span className="block text-[12.5px] text-zinc-500">
                      Only you can access this chat
                    </span>
                  </span>
                  {mode === "private" ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Check className="h-3 w-3 stroke-[3px]" />
                    </span>
                  ) : null}
                </button>

                <div className="h-px bg-zinc-100" />

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSelectLink()}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                    "hover:bg-zinc-50 disabled:opacity-60",
                    mode === "link" && "bg-zinc-50",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <Globe className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-zinc-900">
                      Create public link
                    </span>
                    <span className="block text-[12.5px] text-zinc-500">
                      Anyone with the link can view
                    </span>
                  </span>
                  {mode === "link" ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Check className="h-3 w-3 stroke-[3px]" />
                    </span>
                  ) : busy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  ) : null}
                </button>
              </div>

              {mode === "link" && shareUrl ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                    <Link2 className="h-4 w-4 shrink-0 text-zinc-400" />
                    <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-700">
                      {shareUrl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[13.5px] font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.99]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy link
                      </>
                    )}
                  </button>
                  <p className="text-[12px] leading-snug text-zinc-500">
                    Future messages after you copy are not included until you
                    create a new link.
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="text-[12.5px] text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
