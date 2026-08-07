"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
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
  /** A compact scrollable gallery for the project-creation flow. */
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
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {gallery ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROJECT_ICONS.slice(0, 12).map((icon) => (
            <button
              key={icon}
              type="button"
              disabled={disabled}
              onClick={() => choose(icon)}
              aria-label={`Use ${icon} as the project icon`}
              aria-pressed={value === icon}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border text-xl transition",
                value === icon
                  ? "border-zinc-900 bg-zinc-900/5 shadow-sm"
                  : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50",
              )}
            >
              {icon}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((shown) => !shown)}
            aria-label="Choose another project icon"
            aria-expanded={open}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50"
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
