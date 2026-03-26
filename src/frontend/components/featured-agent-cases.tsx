
'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';

const cases = [
  {
    title: 'Clauxen agent can now create and edit files',
    image: 'https://picsum.photos/seed/case1/480/480',
    tag: 'Limited-time offer',
    tagIcon: '🎁'
  },
  {
    title: 'First-month offer: $0.99',
    image: 'https://picsum.photos/seed/case2/480/480',
    tag: 'Limited-time offer',
    tagIcon: '📊'
  },
  {
    title: 'GenAI Video Startup Report',
    image: 'https://picsum.photos/seed/case3/480/480',
  }
];

export function FeaturedAgentCases() {
  return (
    <div className="w-full max-w-[768px] mt-8 flex flex-col gap-12 pb-16">
      {/* Featured Cases Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-black/60">Featured Agent cases</h2>
          <button className="flex items-center text-[14px] text-black/60 hover:text-black transition-colors group">
            <span>More cases</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cases.map((item, i) => (
            <a
              key={i}
              href="#"
              className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-black/10 shadow-sm hover:shadow-md transition-all"
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
                <p className="text-[14px] text-black/80 font-medium leading-tight line-clamp-2">
                  {item.title}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
