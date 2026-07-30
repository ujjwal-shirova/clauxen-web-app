"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children on document.body so `position: fixed` covers the real viewport.
 * The main agent panel uses `transform: translateZ(0)`, which would otherwise trap
 * fixed descendants inside the content card.
 */
export function FullscreenPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // useLayoutEffect so overlays (settings) paint in the same frame as open.
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
