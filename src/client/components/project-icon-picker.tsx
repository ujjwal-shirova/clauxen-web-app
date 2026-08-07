"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const PROJECT_ICONS = [
  "📁",
  "💡",
  "🧠",
  "📝",
  "💻",
  "📚",
  "🎨",
  "🔬",
  "🚀",
  "📈",
  "🎓",
  "🛡️",
  "🧪",
  "💬",
  "🌱",
  "🌍",
  "🤖",
  "💰",
  "🎯",
  "🧩",
  "⚡",
  "🌈",
  "📰",
  "👀",
  "✅",
  "🗂️",
  "📌",
  "🔭",
  "🎮",
  "🎵",
  "🏗️",
  "🏆",
  "❤️",
  "💜",
  "💚",
  "🖤",
] as const;

type ProjectIconPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
  className?: string;
  /** A click-only folder carousel for the project-creation flow. */
  gallery?: boolean;
};

export function ProjectIconPicker({
  value,
  onChange,
  disabled = false,
  className,
  gallery = false,
}: ProjectIconPickerProps) {
  const [open, setOpen] = useState(false);
  const initialIndex = Math.max(
    0,
    PROJECT_ICONS.indexOf(value as (typeof PROJECT_ICONS)[number]),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = PROJECT_ICONS.indexOf(value as (typeof PROJECT_ICONS)[number]);
    if (next >= 0) setActiveIndex(next);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (icon: string) => {
    onChange(icon);
    setOpen(false);
  };

  const visibleIcons = useMemo(
    () =>
      [-2, -1, 0, 1, 2].map((offset) => {
        const index =
          (activeIndex + offset + PROJECT_ICONS.length) % PROJECT_ICONS.length;
        return { icon: PROJECT_ICONS[index]!, offset, index };
      }),
    [activeIndex],
  );

  const move = (direction: -1 | 1) => {
    const next =
      (activeIndex + direction + PROJECT_ICONS.length) % PROJECT_ICONS.length;
    setActiveIndex(next);
    onChange(PROJECT_ICONS[next]!);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {gallery ? (
        <div className="relative h-[192px] overflow-hidden rounded-2xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/70">
          <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-medium text-zinc-500">
            Pick an icon for your project
          </div>
          <div className="absolute inset-x-0 bottom-3 top-8 flex items-end justify-center">
            {visibleIcons.map(({ icon, offset, index }) => {
              const selected = offset === 0;
              const distance = Math.abs(offset);
              return (
                <button
                  key={`${icon}-${offset}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (selected) setOpen(true);
                    else {
                      setActiveIndex(index);
                      onChange(icon);
                    }
                  }}
                  aria-label={
                    selected
                      ? "Change selected project icon"
                      : `Use ${icon} as the project icon`
                  }
                  aria-pressed={selected}
                  className={cn(
                    "absolute bottom-0 flex flex-col items-center justify-end transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
                    selected
                      ? "z-20 h-[126px] w-[176px] opacity-100"
                      : distance === 1
                        ? "z-10 h-[96px] w-[132px] opacity-65"
                        : "h-[72px] w-[104px] opacity-35",
                    offset === -2 &&
                      "translate-x-[-200px] sm:translate-x-[-270px]",
                    offset === -1 &&
                      "translate-x-[-116px] sm:translate-x-[-166px]",
                    offset === 1 &&
                      "translate-x-[116px] sm:translate-x-[166px]",
                    offset === 2 &&
                      "translate-x-[200px] sm:translate-x-[270px]",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-full w-full items-end justify-end overflow-hidden rounded-[22px] border-2 border-zinc-300 bg-white p-4 shadow-sm transition-transform",
                      selected &&
                        "border-zinc-400 shadow-md hover:-translate-y-1",
                    )}
                  >
                    <span className="absolute left-[14%] top-[-2px] h-7 w-[38%] rounded-t-[16px] border-x-2 border-t-2 border-zinc-300 bg-white" />
                    <span
                      className={cn(
                        "absolute left-5 top-8 h-1 rounded-full bg-zinc-200",
                        selected ? "w-24" : "w-14",
                      )}
                    />
                    <span
                      className={cn(
                        "relative",
                        selected ? "text-4xl" : "text-2xl",
                      )}
                    >
                      {icon}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => move(-1)}
            aria-label="Show previous project icon"
            className="absolute left-2 top-1/2 z-30 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition hover:bg-white hover:text-zinc-950 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => move(1)}
            aria-label="Show next project icon"
            className="absolute right-2 top-1/2 z-30 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition hover:bg-white hover:text-zinc-950 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((shown) => !shown)}
          aria-label="Change project icon"
          aria-expanded={open}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {value || "📁"}
        </button>
      )}

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a project icon"
          className="absolute left-0 top-full z-[120] mt-2 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-800">
            <Sparkles className="size-4 text-zinc-500" /> Choose an icon
          </div>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-9">
            {PROJECT_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => choose(icon)}
                aria-label={`Use ${icon} as the project icon`}
                aria-pressed={value === icon}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg text-xl transition hover:bg-zinc-100",
                  value === icon && "bg-zinc-100 ring-1 ring-zinc-300",
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
