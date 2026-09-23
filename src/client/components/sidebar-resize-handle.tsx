"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useAppPreferences } from "@/contexts/app-preferences-context";
import {
  clampSidebarWidth,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "@/lib/sidebar-width";

export function SidebarResizeHandle() {
  const { general, updateGeneral } = useAppPreferences();
  const widthRef = useRef(general.sidebarWidth);
  const draggingRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    widthRef.current = general.sidebarWidth;
  }, [general.sidebarWidth]);

  const widthFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const panel = event.currentTarget.parentElement;
    const left = panel?.getBoundingClientRect().left ?? 0;
    return clampSidebarWidth(event.clientX - left);
  };

  const paintWidth = (width: number) => {
    widthRef.current = width;
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${width}px`,
    );
  };

  const finishDrag = (width: number) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.documentElement.removeAttribute("data-sidebar-resizing");
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    paintWidth(width);
    updateGeneral({ sidebarWidth: width });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      aria-valuenow={mounted ? general.sidebarWidth : SIDEBAR_WIDTH_DEFAULT}
      tabIndex={0}
      className="app-sidebar-resize"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        document.documentElement.dataset.sidebarResizing = "1";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const next = widthFromEvent(event);
        paintWidth(next);
        event.currentTarget.setAttribute("aria-valuenow", String(next));
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        const next = widthFromEvent(event);
        paintWidth(next);
        event.currentTarget.setAttribute("aria-valuenow", String(next));
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return;
        finishDrag(widthFromEvent(event));
      }}
      onPointerCancel={() => {
        finishDrag(widthRef.current);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 16 : -16;
        const next = clampSidebarWidth(widthRef.current + delta);
        widthRef.current = next;
        updateGeneral({ sidebarWidth: next });
      }}
    />
  );
}
