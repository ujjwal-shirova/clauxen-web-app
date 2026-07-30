"use client";

import React from "react";

/**
 * Self-contained gift motif — soft glass card with SVG ribbon/bow.
 * Works on any preview background (no external assets).
 */
export function GiftAnimation() {
  return (
    <div
      className="relative flex h-[104px] w-[136px] flex-shrink-0 items-center justify-center"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-[18px] border border-white/55 bg-white/28 shadow-[0_12px_32px_rgba(0,0,0,0.12)] backdrop-blur-md" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[17px] bg-gradient-to-br from-white/70 via-white/20 to-white/40" />

      <svg
        viewBox="0 0 120 90"
        className="relative z-10 h-[86px] w-[112px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gift-box-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
          </linearGradient>
          <linearGradient id="gift-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
          </linearGradient>
          <filter id="gift-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.18" />
          </filter>
        </defs>

        <g filter="url(#gift-soft-shadow)">
          <rect
            x="22"
            y="38"
            width="76"
            height="44"
            rx="8"
            fill="url(#gift-box-face)"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="1.2"
          />
          <rect
            x="54"
            y="38"
            width="12"
            height="44"
            fill="url(#gift-ribbon)"
            opacity="0.9"
          />
          <rect
            x="22"
            y="56"
            width="76"
            height="8"
            fill="url(#gift-ribbon)"
            opacity="0.85"
          />

          <path
            d="M60 38 C48 28, 34 30, 30 42 C28 50, 36 54, 44 50 C52 46, 56 40, 60 38 Z"
            fill="rgba(255,255,255,0.88)"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="0.8"
          />
          <path
            d="M60 38 C72 28, 86 30, 90 42 C92 50, 84 54, 76 50 C68 46, 64 40, 60 38 Z"
            fill="rgba(255,255,255,0.82)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.8"
          />
          <circle cx="60" cy="38" r="5.5" fill="rgba(255,255,255,0.95)" />
        </g>

        <ellipse
          cx="60"
          cy="78"
          rx="34"
          ry="5"
          fill="rgba(0,0,0,0.08)"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}
