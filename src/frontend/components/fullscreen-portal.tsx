"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children on document.body so `position: fixed` covers the real viewport.
 * The main agent panel uses `transform: translateZ(0)`, which would otherwise trap
 * fixed descendants inside the content card.
 */
export function FullscreenPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
