'use client';

import { ArrowUpRight, Info } from 'lucide-react';

export function ClauxenCodeSettings() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15">
        <div className="flex items-start justify-between gap-6 text-[#3d3d3a]">
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-[16px] font-semibold">Clauxen Code</h2>
            <p className="text-[14px] leading-relaxed text-[#73726c]">
              Clauxen Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.
            </p>
            <a href="#" className="flex items-center gap-1.5 text-[14px] font-medium text-[#1b67b2] hover:underline">
              Upgrade to Max or Pro <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="shrink-0">
            <div className="overflow-hidden rounded-lg border border-[#1f1e1d]/10 bg-white p-1 shadow-sm">
              <img
                src="https://claude.ai/_next/image?url=%2Fimages%2Fnudges%2Fclaudecode.png&w=384&q=75"
                alt="Clauxen Code Preview"
                className="h-auto w-[135px] rounded"
              />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#1f1e1d]/15 bg-[#f5f4ed] p-4 text-[#3d3d3a]">
          <div className="mt-0.5"><Info className="h-5 w-5 text-[#3d3d3a]" /></div>
          <p className="text-[14px] leading-snug">
            <span className="font-medium">How does usage work?</span> When you sign in to Clauxen Code using your subscription, your subscription usage limits are shared with Clauxen Code.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6 text-[#3d3d3a]">
        <h2 className="text-[16px] font-semibold">Manage your authorization tokens</h2>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1f1e1d]/20 bg-[#faf9f5]/50 p-12 text-center">
          <p className="mb-1 text-[14px] font-medium">No connected Clauxen Code instances</p>
          <p className="text-[14px] text-[#73726c]">When you sign in to Clauxen Code, your authorization tokens will appear here.</p>
        </div>
      </section>
    </div>
  );
}
