'use client';

import React from 'react';
import { Code2, Link2, MessageSquarePlus, PlusCircle } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';

const featureItems = [
  {
    icon: Code2,
    title: 'Deploy OpenClaw in seconds',
    description:
      'Clauxen deploys OpenClaw in one click with no complex setup, so your assistant can stay online and work around the clock.',
  },
  {
    icon: MessageSquarePlus,
    title: 'Chat freely through Clauxen',
    description:
      'Preconfigured with reasoning and ready-to-use skills, Clauxen Claw can collaborate across tools and proactively complete tasks.',
  },
];

const starterCards = [
  {
    title: 'Create Clauxen Claw',
    subtitle: 'Deploy OpenClaw with one click',
    cta: 'Create',
    image:
      'https://statics.moonshot.cn/kimi-web-seo/assets/kimiclaw-avatar-ByS08mNd.png',
  },
];

export function ClauxenClawView() {
  return (
    <div className="flex flex-1 w-full bg-[#faf9f5] animate-in fade-in duration-500 font-sans h-full overflow-y-auto scrollbar-hide">
      <div className="w-full max-w-[640px] mx-auto px-6 sm:px-8 py-8 sm:py-10">
        <section className="mb-6 rounded-2xl overflow-hidden border border-[#1f1e1d]/10 bg-white shadow-[0_8px_28px_rgba(20,20,19,0.06)]">
          <div className="relative w-full aspect-video bg-gradient-to-br from-[#ebe8de] via-[#f7f5ef] to-[#e8e3d6]">
            <video
              className="w-full h-full object-cover"
              src="//statics.moonshot.cn/kimi-web-seo/assets/claw-hero-D59VliO4.mp4"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
        </section>

        <section className="mb-6 border-b border-[#1f1e1d]/15 pb-6 space-y-4">
          {featureItems.map((item) => (
            <article key={item.title} className="space-y-2">
              <h3 className="text-[15px] font-semibold text-[#1f1e1d] leading-5 flex items-center gap-2">
                <item.icon className="w-[18px] h-[18px] text-[#1f1e1d]" />
                <span>{item.title}</span>
              </h3>
              <p className="text-[14px] leading-5 text-[#1f1e1d]/65">
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#1f1e1d]">Get started</h2>
            <button className="inline-flex items-center gap-1.5 text-[14px] text-[#1f1e1d]/60 hover:text-[#1f1e1d] transition-colors">
              <Link2 className="w-4 h-4" />
              <span>Link existing OpenClaw</span>
            </button>
          </div>

          {starterCards.map((card) => (
            <article
              key={card.title}
              className={cn(
                'rounded-xl border border-[#1f1e1d]/10 bg-[#1f1e1d]/[0.03]',
                'p-4 flex items-center gap-3 transition-all hover:bg-[#1f1e1d]/[0.05]'
              )}
            >
              <div
                className="w-12 h-12 rounded-xl bg-center bg-cover bg-no-repeat shrink-0"
                style={{ backgroundImage: `url("${card.image}")` }}
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-[14px] leading-5 font-medium text-[#1f1e1d] truncate">
                  {card.title}
                </h4>
                <p className="text-[13px] leading-5 text-[#1f1e1d]/60 truncate">
                  {card.subtitle}
                </p>
              </div>
              <button className="h-8 min-w-[78px] px-3 rounded-lg bg-[#1f1e1d] text-white text-[13px] font-medium hover:bg-black transition-colors inline-flex items-center justify-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{card.cta}</span>
              </button>
            </article>
          ))}

        </section>
      </div>
    </div>
  );
}
