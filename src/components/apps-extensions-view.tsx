"use client";

import React, { useRef } from "react";
import { ArrowLeft, Smartphone, Laptop, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { useOverlaySurfaceFocus } from "@/lib/surface-focus";

interface AppsExtensionsViewProps {
  onClose: () => void; // back button / overlay dismiss callback
  onUpgradeClick: () => void; // paid plan upgrade flow trigger — billing view
}

export function AppsExtensionsView({
  onClose,
  onUpgradeClick,
}: AppsExtensionsViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOverlaySurfaceFocus(surfaceRef);
  return (
    <FullscreenPortal>
    <div ref={surfaceRef} data-app-overlay-surface="" tabIndex={-1} className="fixed inset-0 z-[200] flex min-h-0 flex-col overflow-hidden bg-zinc-50 pt-[env(safe-area-inset-top)] outline-none">
      {/* header — centered layout with absolute-positioned back button */}
      <header className="relative z-20 flex w-full shrink-0 items-center justify-center bg-zinc-50/80 px-4 py-3.5 backdrop-blur-md sm:py-5">
        {/* back button — absolute left; onClose parent callback */}
        <button
          type="button"
          onClick={onClose}
          className="ui-icon-button no-hover-overlay absolute left-3 top-1/2 -translate-y-1/2 text-zinc-800 sm:left-6"
          aria-label="Back"
        >
          <ArrowLeft className="icon-lg" />
        </button>
      </header>

      {/* scrollable main content — bottom padding for safe scroll area */}
      <div className="mobile-page-inset flex-1 overflow-y-auto pb-24 sm:px-6">
        {/* centered column — max-width 896px, responsive top padding */}
        <div className="mx-auto flex w-full max-w-[896px] flex-col items-center pt-3 sm:pt-8">
          <h2 className="mb-6 max-w-[18ch] text-center text-[22px] font-semibold leading-tight tracking-[-0.03em] text-zinc-800 sm:mb-10 sm:max-w-none sm:text-[28px]">
            Do more with Clauxen, everywhere you work
          </h2>

          {/* product cards grid — 1 col mobile, 2 col md; Cowork spans full width */}
          <div className="grid w-full grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
            {/* Cowork hero card — featured desktop product, md:col-span-2 full row */}
            <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-2 shadow-sm transition-all hover:shadow-md sm:p-2.5 md:col-span-2">
              <div className="grid h-full grid-cols-1 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 md:grid-cols-2">
                {/* left column — title, description, Upgrade CTA */}
                <div className="flex flex-col justify-between p-5 sm:p-7">
                  <div>
                    {/* Cowork product name */}
                    <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                      Cowork
                    </h3>
                    {/* product description — Pro/Max plans, desktop-only emphasis */}
                    <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                      Clauxen works in your files and browser tabs to help you
                      get things done.
                      <br />
                      <br />
                      Available for Pro and Max plans.
                      <br />
                      <span className="font-semibold text-zinc-800">
                        Only on desktop.
                      </span>
                    </p>
                  </div>
                  {/* Upgrade button — onUpgradeClick billing flow */}
                  <Button
                    onClick={onUpgradeClick}
                    className={cn(appBtn.primary, "w-fit px-6")}
                  >
                    Upgrade
                  </Button>
                </div>
                {/* right column — decorative browser/window mockup preview */}
                <div className="relative min-h-[240px] bg-gradient-to-br from-zinc-50 to-zinc-100">
                  {/* dot grid background pattern — radial-gradient CSS inline style */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, rgba(20, 20, 19, 0.15) 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  {/* centered mock window container */}
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    {/* faux browser window — aspect-video, shadow, rounded corners */}
                    <div className="relative w-full aspect-video bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden">
                      {/* macOS-style traffic light window controls */}
                      <div className="h-6 bg-[#E5E7EB] flex items-center px-3 gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                        <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                        <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                      </div>
                      {/* skeleton content lines — placeholder UI mock */}
                      <div className="p-4 space-y-2">
                        <div className="h-2 w-3/4 bg-gray-100 rounded" />
                        <div className="h-2 w-1/2 bg-gray-100 rounded" />
                        {/* Clauxen avatar chip + text bar skeleton */}
                        <div className="pt-4 flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-[10px] text-white">
                            C
                          </div>
                          <div className="h-2 w-1/3 bg-gray-200 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-zinc-200 bg-white p-2.5 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-7">
                {/* Mobile section title */}
                <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                  Mobile
                </h3>
                {/* Mobile value proposition copy */}
                <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                  Tap into your health data, notes, and reminders.
                </p>
                {/* platform rows — mt-auto pushes list to card bottom */}
                <div className="space-y-3 mt-auto">
                  {/* iOS row — icon, label, App Store link */}
                  <div className="flex items-center justify-between py-3 border-b border-black/5">
                    <div className="flex items-center gap-3">
                      <Smartphone className="icon-lg text-zinc-500" />
                      <span className="text-[14px]">iOS</span>
                    </div>
                    <a
                      href="https://apps.apple.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] font-medium text-zinc-800 px-4 py-1.5 border border-black/15 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                  {/* Android row — icon, label, Play Store link */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="icon-lg text-zinc-500" />
                      <span className="text-[14px]">Android</span>
                    </div>
                    <a
                      href="https://play.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] font-medium text-zinc-800 px-4 py-1.5 border border-black/15 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Clauxen Code card — terminal/IDE integrations, upgrade-gated */}
            <div className="rounded-[20px] border border-zinc-200 bg-white p-2.5 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-7">
                {/* Clauxen Code product title */}
                <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                  Clauxen Code
                </h3>
                {/* developer workflow description */}
                <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                  Build, debug, and ship from your terminal or IDE.
                </p>
                {/* outline Upgrade CTA — transparent style */}
                <Button
                  onClick={onUpgradeClick}
                  className="w-fit h-9 px-6 bg-transparent border border-black/15 text-zinc-800 hover:bg-zinc-100 rounded-lg mb-6"
                >
                  Upgrade
                </Button>
                {/* integration list — each row onUpgradeClick placeholder navigation */}
                <div className="space-y-1">
                  {/* Terminal integration row — hover chevron reveal */}
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="w-full flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Laptop className="icon-lg text-zinc-500" />
                      <span className="text-[14px]">Terminal</span>
                    </div>
                    <ChevronRight className="icon-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  {/* VS Code integration row — brand color square icon */}
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="w-full flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#007ACC] rounded-sm" />
                      </div>
                      <span className="text-[14px]">VS Code</span>
                    </div>
                    <ChevronRight className="icon-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  {/* JetBrains integration row — pink brand accent */}
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="w-full flex items-center justify-between py-3 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#FE2857] rounded-sm" />
                      </div>
                      <span className="text-[14px]">JetBrains</span>
                    </div>
                    <ChevronRight className="icon-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              </div>
            </div>

            {/* Microsoft Office card — Excel/PowerPoint add-ins, green gradient tint */}
            <div className="rounded-[20px] border border-zinc-200 bg-white p-2.5 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100/80 p-7">
                {/* Microsoft Office section title */}
                <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                  Microsoft Office
                </h3>
                {/* Office copilot-style value proposition */}
                <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                  Analyze data and build presentations with Clauxen alongside
                  you.
                </p>
                {/* outline Upgrade CTA */}
                <Button
                  onClick={onUpgradeClick}
                  className="w-fit h-9 px-6 bg-transparent border border-black/15 text-zinc-800 hover:bg-zinc-100 rounded-lg mb-6"
                >
                  Upgrade
                </Button>
                {/* Office app integration rows */}
                <div className="space-y-1">
                  {/* Excel row — green brand square */}
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="w-full flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#1D6F42] rounded-sm" />
                      </div>
                      <span className="text-[14px]">Excel</span>
                    </div>
                    <ChevronRight className="icon-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  {/* PowerPoint row — red brand square */}
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="w-full flex items-center justify-between py-3 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#B7472A] rounded-sm" />
                      </div>
                      <span className="text-[14px]">PowerPoint</span>
                    </div>
                    <ChevronRight className="icon-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chrome extension card — browser automation, red-tint gradient */}
            <div className="rounded-[20px] border border-zinc-200 bg-white p-2.5 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100/80 p-7">
                {/* Chrome extension title */}
                <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                  Chrome
                </h3>
                {/* browser automation description — Cowork synergy mention */}
                <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                  Clauxen navigates, clicks buttons, and fills forms in your
                  browser. Works in Cowork.
                </p>
                {/* Upgrade CTA — mt-auto bottom-aligns button in flex column */}
                <Button
                  onClick={onUpgradeClick}
                  className="w-fit h-9 px-6 bg-transparent border border-black/15 text-zinc-800 hover:bg-zinc-100 rounded-lg mt-auto"
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
