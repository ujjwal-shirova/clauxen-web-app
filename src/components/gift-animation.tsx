'use client';

import React from 'react';

export function GiftAnimation() {
  return (
    <div 
      className="relative flex h-[104px] w-[136px] flex-shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/50 bg-white/35 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-[6px]"
      style={{
        fontFamily: '"Anthropic Sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div className="pointer-events-none absolute inset-[1px] rounded-[17px] bg-gradient-to-br from-white/55 via-white/10 to-white/35" />
      <img
        src="https://claude.ai/images/gift/gift-giving.gif"
        alt=""
        width={120}
        height={90}
        loading="lazy"
        className="relative z-10 block h-[90px] w-[120px] object-contain align-middle"
      />
    </div>
  );
}
