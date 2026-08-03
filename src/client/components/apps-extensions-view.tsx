"use client";

import React, { useRef } from "react";
import { ArrowLeft, Smartphone, Laptop, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { useOverlaySurfaceFocus } from "@/lib/surface-focus";

interface AppsExtensionsViewProps {
  onClose: () => void;
  onUpgradeClick: () => void;
}

const cardShell =
  "settings-card overflow-hidden transition-colors hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_92%,#18181b)]";

const cardInner =
  "flex h-full flex-col bg-[var(--settings-canvas-bg)] p-5 sm:p-6";

const cardTitle = "settings-section-label mb-1.5";
const cardBody = "settings-muted mb-5 leading-[18px]";

const rowBase =
  "flex w-full items-center justify-between gap-3 border-b border-[var(--settings-hairline)] py-2.5 last:border-b-0";

const downloadLink = cn(
  appBtn.secondarySm,
  "no-hover-overlay shrink-0 px-3 no-underline",
);

export function AppsExtensionsView({
  onClose,
  onUpgradeClick,
}: AppsExtensionsViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOverlaySurfaceFocus(surfaceRef);
  return (
    <FullscreenPortal>
      <div
        ref={surfaceRef}
        data-app-overlay-surface=""
        tabIndex={-1}
        className={cn(
          chrome.overlay.surface,
          "settings-canvas pt-[env(safe-area-inset-top)]",
        )}
      >
        <header className="relative z-20 flex w-full shrink-0 items-center justify-center px-4 py-3 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button no-hover-overlay absolute left-3 top-1/2 -translate-y-1/2 text-[var(--settings-fg)] sm:left-6"
            aria-label="Back"
          >
            <ArrowLeft className="icon-lg" />
          </button>
        </header>

        <div className="mobile-page-inset flex-1 overflow-y-auto pb-24 sm:px-6">
          <div className="mx-auto flex w-full max-w-[880px] flex-col items-center pt-2 sm:pt-6">
            <h2 className="app-page-title mb-6 max-w-[22ch] text-center sm:mb-8 sm:max-w-none">
              Do more with Clauxen, everywhere you work
            </h2>

            <div className="grid w-full grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              {/* Cowork */}
              <div className={cn(cardShell, "md:col-span-2")}>
                <div className="grid h-full grid-cols-1 overflow-hidden md:grid-cols-2">
                  <div className={cn(cardInner, "justify-between")}>
                    <div>
                      <h3 className={cardTitle}>Cowork</h3>
                      <p className={cardBody}>
                        Clauxen works in your files and browser tabs to help you
                        get things done.
                        <br />
                        <br />
                        Available for Pro and Max plans.
                        <br />
                        <span className="font-medium text-[var(--settings-fg)]">
                          Only on desktop.
                        </span>
                      </p>
                    </div>
                    <Button
                      onClick={onUpgradeClick}
                      className={cn(appBtn.primary, "w-fit px-4")}
                    >
                      Upgrade
                    </Button>
                  </div>
                  <div className="relative min-h-[200px] bg-[var(--settings-canvas-bg)]">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle, rgba(24, 24, 27, 0.12) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="relative aspect-video w-full max-w-[320px] overflow-hidden rounded-[var(--settings-card-radius)] bg-[var(--settings-card-bg)] shadow-[var(--settings-card-shadow)]">
                        <div className="flex h-6 items-center gap-1.5 bg-[color-mix(in_oklab,#18181b_6%,transparent)] px-3">
                          <div className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                          <div className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                          <div className="h-2 w-2 rounded-full bg-[#28C840]" />
                        </div>
                        <div className="space-y-2 p-3.5">
                          <div className="h-1.5 w-3/4 rounded bg-[color-mix(in_oklab,#18181b_8%,transparent)]" />
                          <div className="h-1.5 w-1/2 rounded bg-[color-mix(in_oklab,#18181b_8%,transparent)]" />
                          <div className="flex items-center gap-2 pt-3">
                            <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--settings-fg)] text-[9px] text-[var(--settings-canvas-bg)]">
                              C
                            </div>
                            <div className="h-1.5 w-1/3 rounded bg-[color-mix(in_oklab,#18181b_10%,transparent)]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div className={cardShell}>
                <div className={cardInner}>
                  <h3 className={cardTitle}>Mobile</h3>
                  <p className={cardBody}>
                    Tap into your health data, notes, and reminders.
                  </p>
                  <div className="mt-auto">
                    <div className={rowBase}>
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="icon-md text-[var(--settings-fg-muted)]" />
                        <span className="app-page-body">iOS</span>
                      </div>
                      <a
                        href="https://apps.apple.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={downloadLink}
                      >
                        Download
                      </a>
                    </div>
                    <div className={rowBase}>
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="icon-md text-[var(--settings-fg-muted)]" />
                        <span className="app-page-body">Android</span>
                      </div>
                      <a
                        href="https://play.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={downloadLink}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clauxen Code */}
              <div className={cardShell}>
                <div className={cardInner}>
                  <h3 className={cardTitle}>Clauxen Code</h3>
                  <p className={cardBody}>
                    Build, debug, and ship from your terminal or IDE.
                  </p>
                  <Button
                    onClick={onUpgradeClick}
                    className={cn(appBtn.secondary, "mb-4 w-fit px-4")}
                  >
                    Upgrade
                  </Button>
                  <div>
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className={cn(rowBase, "group text-left transition-colors hover:bg-[var(--ui-hover-wash)]")}
                    >
                      <div className="flex items-center gap-2.5">
                        <Laptop className="icon-md text-[var(--settings-fg-muted)]" />
                        <span className="app-page-body">Terminal</span>
                      </div>
                      <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className={cn(rowBase, "group text-left transition-colors hover:bg-[var(--ui-hover-wash)]")}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-[2px] bg-[#007ACC]" />
                        <span className="app-page-body">VS Code</span>
                      </div>
                      <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className={cn(rowBase, "group text-left transition-colors hover:bg-[var(--ui-hover-wash)]")}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-[2px] bg-[#FE2857]" />
                        <span className="app-page-body">JetBrains</span>
                      </div>
                      <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Microsoft Office */}
              <div className={cardShell}>
                <div className={cardInner}>
                  <h3 className={cardTitle}>Microsoft Office</h3>
                  <p className={cardBody}>
                    Analyze data and build presentations with Clauxen alongside
                    you.
                  </p>
                  <Button
                    onClick={onUpgradeClick}
                    className={cn(appBtn.secondary, "mb-4 w-fit px-4")}
                  >
                    Upgrade
                  </Button>
                  <div>
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className={cn(rowBase, "group text-left transition-colors hover:bg-[var(--ui-hover-wash)]")}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-[2px] bg-[#1D6F42]" />
                        <span className="app-page-body">Excel</span>
                      </div>
                      <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className={cn(rowBase, "group text-left transition-colors hover:bg-[var(--ui-hover-wash)]")}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-[2px] bg-[#B7472A]" />
                        <span className="app-page-body">PowerPoint</span>
                      </div>
                      <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Chrome */}
              <div className={cardShell}>
                <div className={cardInner}>
                  <h3 className={cardTitle}>Chrome</h3>
                  <p className={cardBody}>
                    Clauxen navigates, clicks buttons, and fills forms in your
                    browser. Works in Cowork.
                  </p>
                  <Button
                    onClick={onUpgradeClick}
                    className={cn(appBtn.secondary, "mt-auto w-fit px-4")}
                  >
                    Upgrade
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}
