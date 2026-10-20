"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import Image from "next/image"; // next/image — optimized fill layout thumbnails

const cases = [
  {
    title: "Clauxen agent can now create and edit files", // card headline — file editing capability highlight
    image: "https://picsum.photos/seed/case1/480/480", // placeholder hero image — seed case1
    tag: "Limited-time offer", // optional badge — promotional tag text
    tagIcon: "🎁", // badge emoji — visual tag accent
  },
  {
    title: "First-month offer: $0.99", // pricing promo card title
    image: "https://picsum.photos/seed/case2/480/480", // placeholder image — seed case2
    tag: "Limited-time offer", // promotional badge
    tagIcon: "📊", // chart emoji — offer/analytics visual
  },
  {
    title: "GenAI Video Startup Report", // research/report style case — no promotional tag
    image: "https://picsum.photos/seed/case3/480/480", // placeholder image — seed case3
  },
];

export function FeaturedAgentCases() {
  return (
    <div className="w-full max-w-[768px] mt-8 flex flex-col gap-12 pb-16">
      {/* Featured cases section — heading row + responsive card grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-black/60 dark:text-zinc-400">
            Featured Agent cases
          </h2>
          <button className="flex items-center text-[14px] text-black/60 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group">
            <span>More cases</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cases.map((item, i) => (
            <button
              key={i}
              type="button"
              className="group relative flex flex-col bg-white dark:bg-[#202023] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm hover:shadow-md transition-all text-left w-full"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  data-ai-hint="agent case"
                />
                {item.tag && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-md rounded-full text-[10px] text-white font-medium z-10">
                    <span>{item.tagIcon}</span>
                    <span>{item.tag}</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[14px] text-black/80 dark:text-zinc-200 font-medium leading-tight line-clamp-2">
                  {item.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
