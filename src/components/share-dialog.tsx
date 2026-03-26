'use client';

import React, { useState } from 'react';
import { X, Lock, Globe, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = "https://claude.ai/share/b2fd1bc3-00dc-429f-878f-48da8239f970";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[calc(100vw-24px)] sm:w-[calc(100vw-32px)] max-w-[540px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] overflow-visible p-6 sm:p-8 bg-[#FAF9F5] border-[#1F1E1D]/15 rounded-[16px] shadow-2xl font-sans border-[0.666667px] gap-0 duration-200 ease-out [&>button]:hidden"
      >
        <div className="flex max-h-[calc(100vh-72px)] flex-col gap-6 overflow-y-auto pr-1 sm:max-h-[calc(100vh-96px)]">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
            <DialogTitle className="text-[20px] font-semibold text-[#1F1E1D] leading-[28px]">
              Chat shared
            </DialogTitle>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 hover:bg-black/5 rounded-lg transition-colors text-[#73726C]"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>
          
          <DialogDescription className="sr-only">
            Manage sharing settings for this conversation.
          </DialogDescription>

          <div className="flex flex-col gap-4">
            <div className="pb-2">
              <span className="text-[14px] text-[#3D3D3A] font-[430]">Future messages aren’t included</span>
            </div>
            
            <div className="flex flex-col border-[0.666667px] border-[#1F1E1D]/15 rounded-xl overflow-hidden bg-white">
              {/* Keep Private Option */}
              <button className="flex items-center gap-3 p-4 hover:bg-black/[0.02] transition-colors border-b-[0.666667px] border-[#1F1E1D]/15 text-left group">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-[#3D3D3A]" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-[#1F1E1D] leading-tight">Keep private</p>
                  <p className="text-[14px] text-[#73726C] mt-0.5 leading-tight">Only you have access</p>
                </div>
              </button>
              
              {/* Public Link Option */}
              <button className="flex items-center gap-3 p-4 bg-[#FAF9F5]/50 text-left relative group">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-[#3D3D3A]" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-[#1F1E1D] leading-tight">Create public link</p>
                  <p className="text-[14px] text-[#73726C] mt-0.5 leading-tight">Anyone with the link can view</p>
                </div>
                <div className="w-5 h-5 bg-[#2C84DB] rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                </div>
              </button>
            </div>

            {/* Link URL and Copy Section */}
            <div className="mt-2 flex flex-col gap-3 rounded-xl border-[0.666667px] border-[#1F1E1D]/30 bg-[#F5F4ED] p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-3 group relative">
              <div className="relative min-w-0 flex-1">
                <span className="block break-all pr-8 text-[14px] font-[430] text-[#3D3D3A] sm:truncate sm:break-normal">
                  {shareUrl}
                </span>
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#F5F4ED] to-transparent pointer-events-none" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className="text-[#73726C]">
                    <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z" />
                  </svg>
                </div>
              </div>
              <button 
                onClick={handleCopy}
                className="h-10 w-full rounded-lg bg-[#1F1E1D] px-4 text-[14px] font-medium text-white transition-all hover:bg-black active:scale-95 sm:h-9 sm:w-auto sm:min-w-[108px] sm:shrink-0"
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
