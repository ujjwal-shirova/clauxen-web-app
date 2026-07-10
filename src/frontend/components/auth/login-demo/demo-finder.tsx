"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { DemoAttachment } from "./demo-files";

/**
 * Demo-only macOS Finder — visual twin for the login animation.
 * Isolated from real file pickers; never opens OS dialogs.
 */
export function DemoFinder({
  files,
  selectedIds,
  draggingIds,
  className,
  style,
}: {
  files: DemoAttachment[];
  selectedIds: string[];
  draggingIds?: string[];
  className?: string;
  style?: CSSProperties;
}) {
  const selected = new Set(selectedIds);
  const dragging = new Set(draggingIds ?? []);

  return (
    <div
      data-demo-finder
      className={cn(
        "flex h-[220px] w-[280px] flex-col overflow-hidden rounded-[10px] border border-black/10 bg-[#ececec] shadow-[0_22px_50px_-18px_rgba(15,23,42,0.55),0_0_0_0.5px_rgba(0,0,0,0.08)]",
        className,
      )}
      style={style}
      aria-hidden
    >
      {/* Title bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-[#f6f6f6] px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="ml-1 flex items-center gap-0.5 text-zinc-400">
          <ChevronLeft className="h-3 w-3" strokeWidth={2.25} />
          <ChevronRight className="h-3 w-3 opacity-40" strokeWidth={2.25} />
        </div>
        <div className="mx-auto flex h-5 min-w-0 flex-1 items-center justify-center rounded-md bg-white/80 px-2 text-[10px] font-medium text-zinc-600 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.06)]">
          Documents
        </div>
        <Search className="h-3 w-3 shrink-0 text-zinc-400" strokeWidth={2} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-[78px] shrink-0 flex-col gap-0.5 border-r border-black/5 bg-[#e8e8e8]/90 px-1.5 py-2 text-[9px] text-zinc-600">
          <p className="px-1.5 pb-0.5 text-[8px] font-semibold uppercase tracking-wide text-zinc-400">
            Favorites
          </p>
          {["Recents", "Desktop", "Documents", "Downloads"].map((item, i) => (
            <div
              key={item}
              className={cn(
                "rounded-[5px] px-1.5 py-0.5",
                i === 2 && "bg-[#0a84ff] font-medium text-white",
              )}
            >
              {item}
            </div>
          ))}
        </aside>

        {/* Icon grid */}
        <div className="min-h-0 flex-1 overflow-hidden bg-white p-2.5">
          <div className="grid grid-cols-2 gap-2">
            {files.map((file) => {
              const isSelected = selected.has(file.id);
              const isDragging = dragging.has(file.id);
              return (
                <div
                  key={file.id}
                  data-demo-finder-file={file.id}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-opacity",
                    isSelected && "bg-[#0a84ff]/12 ring-1 ring-[#0a84ff]/35",
                    isDragging && "opacity-35",
                  )}
                >
                  <div
                    className="relative h-11 w-11 overflow-hidden rounded-[7px] border border-black/5 shadow-sm"
                    style={{ background: file.kind === "image" ? undefined : "#fafafa" }}
                  >
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <span
                    className={cn(
                      "max-w-full truncate rounded-[3px] px-1 text-center text-[8.5px] leading-3 text-zinc-700",
                      isSelected && "bg-[#0a84ff] text-white",
                    )}
                  >
                    {file.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Floating ghost stack while dragging files toward the composer. */
export function DemoDragGhost({
  files,
  x,
  y,
  visible,
}: {
  files: DemoAttachment[];
  x: number;
  y: number;
  visible: boolean;
}) {
  if (!visible || files.length === 0) return null;

  return (
    <div
      data-demo-drag-ghost
      className="pointer-events-none absolute z-50"
      style={{
        left: x,
        top: y,
        transform: "translate(-30%, -70%)",
      }}
      aria-hidden
    >
      <div className="relative h-14 w-14">
        {files.slice(0, 3).map((file, i) => (
          <div
            key={file.id}
            className="absolute h-11 w-11 overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.45)]"
            style={{
              left: i * 6,
              top: i * 5,
              zIndex: 3 - i,
              rotate: `${(i - 1) * 6}deg`,
            }}
          >
            <img
              src={file.previewUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[9px] font-semibold text-white">
          {files.length}
        </span>
      </div>
    </div>
  );
}
