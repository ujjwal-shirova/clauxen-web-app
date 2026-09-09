"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Globe,
  Link2,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as shareApi from "@/lib/api/share";

type ShareMode = "private" | "link";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string | null;
}

/**
 * Share dialog: private vs public link snapshot.
 * Wired to `/api/v1/chats/[chatId]/share`.
 *
 * Renders via portal on document.body with framer-motion animations.
 */
export function ShareDialog({ isOpen, onClose, chatId }: ShareDialogProps) {
  const [mode, setMode] = useState<ShareMode>("private");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset and load share state when the dialog opens.
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

  // Close on Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose]);

  const handleSelectPrivate = useCallback(async () => {
    if (!chatId || busy) return;
    if (mode === "private" && !shareUrl) {
      setMode("private");
      return;
    }
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
  }, [chatId, busy, mode, shareUrl]);

  const handleSelectLink = useCallback(async () => {
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
  }, [chatId, busy]);

  const handleCopy = useCallback(async () => {
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
  }, [shareUrl]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-[var(--overlay-scrim)] backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden
          />

          {/* Popup */}
          <motion.div
            key="share-popup"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={cn(
                "app-dialog-panel w-[min(400px,calc(100vw-24px))] overflow-hidden !rounded-[20px]",
              )}
            >
              {/* Header */}
              <div className="px-5 pb-0 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[18px] font-semibold leading-none tracking-[-0.02em] text-[var(--ui-fg)]">
                      Share chat
                    </h2>
                    <p className="mt-2.5 pr-10 text-[13.5px] leading-[1.45] text-[var(--ui-fg-muted)]">
                      Create a link to share a read-only snapshot of this chat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      "ui-icon-button !size-8 !rounded-lg border border-[var(--ui-border)] text-[var(--ui-fg-muted)]",
                      "transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
                    )}
                    aria-label="Close"
                  >
                    <X className="h-[15px] w-[15px]" strokeWidth={2.25} />
                  </button>
                </div>
              </div>

              <div className="mx-5 mb-5 mt-4 h-px bg-[var(--ui-border-subtle)]" />

              <div className="px-5 pb-5">
                {!chatId ? (
                  <p className="py-2 text-[13.5px] text-[var(--ui-fg-muted)]">
                    Send a message first to share this chat.
                  </p>
                ) : loading ? (
                  <div className="flex items-center gap-2 py-8 text-[13.5px] text-[var(--ui-fg-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {/* Options card */}
                    <div className="overflow-hidden rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)]">
                      {/* Keep private option */}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSelectPrivate()}
                        className={cn(
                          "flex w-full items-center gap-3.5 px-3.5 py-3.5 text-left transition-colors",
                          "disabled:opacity-60",
                          mode === "private"
                            ? "bg-[var(--ui-hover-wash)]"
                            : "bg-transparent hover:bg-[var(--ui-hover-wash)]",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ui-muted-surface)] text-[var(--ui-fg)]">
                          <Lock className="h-[17px] w-[17px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold leading-tight text-[var(--ui-fg)]">
                            Keep private
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-tight text-[var(--ui-fg-muted)]">
                            Only you can access this chat
                          </span>
                        </span>
                        {mode === "private" ? (
                          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--ui-fg)] text-[var(--app-panel-bg)]">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="h-[22px] w-[22px] shrink-0" />
                        )}
                      </button>

                      <div className="h-px bg-[var(--ui-border-subtle)]" />

                      {/* Create public link option */}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSelectLink()}
                        className={cn(
                          "flex w-full items-center gap-3.5 px-3.5 py-3.5 text-left transition-colors",
                          "disabled:opacity-60",
                          mode === "link"
                            ? "bg-[var(--ui-hover-wash)]"
                            : "bg-transparent hover:bg-[var(--ui-hover-wash)]",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ui-muted-surface)] text-[var(--ui-fg)]">
                          <Globe className="h-[17px] w-[17px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold leading-tight text-[var(--ui-fg)]">
                            Create public link
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-tight text-[var(--ui-fg-muted)]">
                            Anyone with the link can view
                          </span>
                        </span>
                        {mode === "link" ? (
                          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--ui-fg)] text-[var(--app-panel-bg)]">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : busy ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--ui-fg-placeholder)]" />
                        ) : (
                          <span className="h-[22px] w-[22px] shrink-0" />
                        )}
                      </button>
                    </div>

                    {/* Share URL section — animated in/out */}
                    <AnimatePresence mode="wait">
                      {mode === "link" && shareUrl ? (
                        <motion.div
                          key="share-url-section"
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{
                            duration: 0.25,
                            ease: [0.32, 0.72, 0, 1],
                          }}
                        >
                          <div className="flex flex-col gap-2.5">
                            {/* URL display */}
                            <div className="flex items-center gap-2 rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2.5">
                              <Link2 className="h-4 w-4 shrink-0 text-[var(--ui-fg-placeholder)]" />
                              <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--ui-fg-body)]">
                                {shareUrl}
                              </p>
                            </div>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => void handleCopy()}
                              className={cn(
                                "app-btn app-btn-primary app-btn-md no-hover-overlay w-full",
                              )}
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

                            {/* Footnote */}
                            <p className="text-[12px] leading-snug text-[var(--ui-fg-muted)]">
                              Future messages aren&apos;t included until you
                              create a new link.
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {/* Error message */}
                    <AnimatePresence mode="wait">
                      {error ? (
                        <motion.p
                          key="share-error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="text-[12.5px] text-[var(--settings-danger)]"
                          role="alert"
                        >
                          {error}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}