'use client';

import React, { useState } from 'react';
import { X, Lock, Globe, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";
import { cn } from '@/frontend/lib/utils';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string | null;
}

export function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = "https://claude.ai/share/b2fd1bc3-00dc-429f-878f-48da8239f970";

  const handleCopy = () => {
    try {
      const parsed = new URL(shareUrl);
      if (parsed.protocol !== "https:") return;
    } catch {
      return;
    }
    void navigator.clipboard.writeText(shareUrl).catch(() => {}); // deny/errors — no unhandled rejection
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[calc(100vw-24px)] sm:w-[calc(100vw-32px)] max-w-[560px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] overflow-hidden p-0 bg-zinc-50 border-zinc-200 rounded-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.18)] font-sans border-[0.666667px] gap-0 duration-200 ease-out [&>button]:hidden"
      >
        <div className="flex max-h-[calc(100vh-72px)] flex-col overflow-y-auto sm:max-h-[calc(100vh-96px)]">
          <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between space-y-0 border-b border-zinc-200 bg-zinc-50/95 px-6 py-5 text-left backdrop-blur-sm sm:px-8">
            <DialogTitle className="text-[20px] font-semibold text-zinc-900 leading-[28px]">
              Chat shared
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-2 -mr-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-500"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Manage sharing settings for this conversation.
          </DialogDescription>

          <div className="flex flex-col gap-4 px-6 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
            <div className="pb-2">
              <span className="text-[14px] text-zinc-800 font-[430]">Future messages aren’t included</span>
            </div>

            <div className="flex flex-col border-[0.666667px] border-zinc-200 rounded-xl overflow-hidden bg-white">
              {/* Keep Private Option */}
              <button className="flex items-center gap-3 p-4 hover:bg-black/[0.02] transition-colors border-b-[0.666667px] border-zinc-200 text-left group">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-zinc-800" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-zinc-900 leading-tight">Keep private</p>
                  <p className="text-[14px] text-zinc-500 mt-0.5 leading-tight">Only you have access</p>
                </div>
              </button>

              {/* Public Link Option */}
              <button className="flex items-center gap-3 p-4 bg-zinc-50/50 text-left relative group">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-zinc-800" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-zinc-900 leading-tight">Create public link</p>
                  <p className="text-[14px] text-zinc-500 mt-0.5 leading-tight">Anyone with the link can view</p>
                </div>
                <div className="w-5 h-5 bg-[#2C84DB] rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                </div>
              </button>
            </div>

            {/* Link URL and Copy Section */}
            <div className="mt-2 flex flex-col gap-3 rounded-xl border-[0.666667px] border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-3 group relative">
              <div className="relative min-w-0 flex-1">
                <span className="block break-all pr-8 text-[14px] font-[430] text-zinc-800 sm:truncate sm:break-normal">
                  {shareUrl}
                </span>
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#F5F4ED] to-transparent pointer-events-none" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className="text-zinc-500">
                    <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="h-10 w-full rounded-lg bg-zinc-900 px-4 text-[14px] font-medium text-white transition-all hover:bg-zinc-800 no-hover-overlay active:scale-95 sm:h-9 sm:w-auto sm:min-w-[108px] sm:shrink-0"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
