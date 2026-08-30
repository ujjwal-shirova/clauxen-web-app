"use client";

import React from "react";

/**
 * Neutral app-surface tile with a minimal gift-box icon — matches the gift preview card.
 */
export function GiftAnimation() {
  return (
    <div
      className="relative flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[22px] bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-[var(--panel-shadow)] ring-1 ring-[var(--ui-border-subtle)] sm:h-[96px] sm:w-[96px]"
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        className="h-11 w-11 sm:h-12 sm:w-12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 28h28v22a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V28Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M16 28h32v6H16v-6Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M32 28v26"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M32 28c-4.8-7.2-12.5-8.2-15.2-4.6C14.2 26.8 17.6 31 24 31c3.2 0 5.8-1.1 8-3Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M32 28c4.8-7.2 12.5-8.2 15.2-4.6C49.8 26.8 46.4 31 40 31c-3.2 0-5.8-1.1-8-3Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
