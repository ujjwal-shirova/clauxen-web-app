"use client";

import { cn } from "@/lib/utils";

export type ProjectsMobileSegment = {
  id: string;
  label: string;
  badge?: number;
};

type ProjectsMobileSegmentedProps = {
  segments: ProjectsMobileSegment[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function ProjectsMobileSegmented({
  segments,
  value,
  onChange,
  className,
}: ProjectsMobileSegmentedProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b border-zinc-100 bg-white px-3 py-2.5 sm:px-4",
        className,
      )}
      role="tablist"
      aria-label="Project sections"
    >
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {segments.map((segment) => {
          const active = segment.id === value;
          return (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(segment.id)}
              className={cn(
                "flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all active:scale-[0.98]",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              <span>{segment.label}</span>
              {segment.badge != null && segment.badge > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                    active
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-200 text-zinc-600",
                  )}
                >
                  {segment.badge > 99 ? "99+" : segment.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
