"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Abstract neural / knowledge-cluster mark for the self-growth promo. */
export function SelfGrowthGraphic({
  className,
  muted = false,
}: {
  className?: string;
  muted?: boolean;
}) {
  const dots = [
    { cx: 80, cy: 48, r: 7, o: 0.95 },
    { cx: 108, cy: 42, r: 5, o: 0.7 },
    { cx: 54, cy: 58, r: 5.5, o: 0.75 },
    { cx: 96, cy: 72, r: 9, o: 1 },
    { cx: 70, cy: 88, r: 6, o: 0.85 },
    { cx: 118, cy: 78, r: 4.5, o: 0.55 },
    { cx: 48, cy: 96, r: 4, o: 0.45 },
    { cx: 88, cy: 104, r: 7.5, o: 0.9 },
    { cx: 112, cy: 108, r: 5, o: 0.65 },
    { cx: 64, cy: 118, r: 4.5, o: 0.5 },
    { cx: 100, cy: 128, r: 6, o: 0.8 },
    { cx: 76, cy: 136, r: 4, o: 0.4 },
    { cx: 124, cy: 98, r: 3.5, o: 0.35 },
    { cx: 40, cy: 74, r: 3.5, o: 0.3 },
    { cx: 132, cy: 60, r: 3, o: 0.25 },
    { cx: 56, cy: 40, r: 3, o: 0.3 },
  ];

  const fill = muted ? "#c4c8ce" : "#3b8eff";

  return (
    <svg
      viewBox="0 0 168 168"
      className={cn("h-36 w-36 sm:h-44 sm:w-44", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="sg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={fill} stopOpacity={muted ? 0.08 : 0.18} />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="84" cy="90" r="70" fill="url(#sg-glow)" />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={fill}
          opacity={muted ? Math.min(0.35, d.o * 0.4) : d.o}
        />
      ))}
      {/* Inner “knowledge” nodes */}
      <circle
        cx="96"
        cy="72"
        r="9"
        fill="none"
        stroke={muted ? "#d0d4da" : "#8ec4ff"}
        strokeWidth="1.2"
        opacity={muted ? 0.5 : 0.9}
      />
      <circle
        cx="88"
        cy="104"
        r="7.5"
        fill="none"
        stroke={muted ? "#d0d4da" : "#8ec4ff"}
        strokeWidth="1"
        opacity={muted ? 0.4 : 0.75}
      />
    </svg>
  );
}
