"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";

type OrbCursorProps = {
  className?: string;
  style?: React.CSSProperties;
};

export const OrbCursor = ({ className, style }: OrbCursorProps) => (
  <span
    className={cn(
      "inline-flex items-center justify-center ml-1 translate-y-[2px] align-baseline",
      className,
    )}
    style={style}
    aria-hidden
  >
    <span className="orb-cursor-shell">
      <span className="orb-cursor-core" />
    </span>
  </span>
);
