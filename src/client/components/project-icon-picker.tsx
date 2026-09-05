"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import {
  PROJECT_COLORS,
  PROJECT_ICONS,
  resolveProjectColor,
  resolveProjectIcon,
} from "@/lib/project-appearance";

export { PROJECT_ICONS };

type ProjectIconPickerProps = {
  icon: string;
  color: string;
  onChange: (next: { icon: string; color: string }) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** @deprecated Gallery carousel removed — kept so older call sites type-check. */
  gallery?: boolean;
  /** @deprecated Use `icon` + `color` instead. */
  value?: string;
};

export function ProjectIconPicker({
  icon,
  color,
  onChange,
  disabled = false,
  className,
  size = "lg",
  value,
}: ProjectIconPickerProps) {
  const [open, setOpen] = useState(false);
  const resolvedIcon = resolveProjectIcon(icon || value);
  const resolvedColor = resolveProjectColor(color);

  const chooseIcon = (nextIcon: string) => {
    onChange({ icon: nextIcon, color: resolvedColor });
  };

  const chooseColor = (nextColor: string) => {
    onChange({ icon: resolvedIcon, color: nextColor });
  };

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Change project icon and color"
          aria-expanded={open}
          className={cn(
            "group relative rounded-full outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <ProjectAvatar icon={resolvedIcon} color={resolvedColor} size={size} />
          <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition group-hover:bg-black/10" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={10}
        className="z-[120] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-[0_8px_28px_rgba(24,24,27,0.14)]"
      >
        <div className="mb-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-zinc-500">
            Color
          </p>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {PROJECT_COLORS.map((swatch) => {
              const selected = resolvedColor.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Use ${swatch} as the project color`}
                  aria-pressed={selected}
                  onClick={() => chooseColor(swatch)}
                  className={cn(
                    "h-8 w-8 rounded-full transition",
                    selected
                      ? "ring-2 ring-zinc-900 ring-offset-2"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: swatch }}
                />
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-zinc-500">
            Icon
          </p>
          <div className="mt-2 grid max-h-48 grid-cols-8 gap-1 overflow-y-auto pr-0.5">
            {PROJECT_ICONS.map((glyph) => (
              <button
                key={glyph}
                type="button"
                aria-label={`Use ${glyph} as the project icon`}
                aria-pressed={resolvedIcon === glyph}
                onClick={() => chooseIcon(glyph)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-lg transition hover:bg-zinc-100",
                  resolvedIcon === glyph && "bg-zinc-100 ring-1 ring-zinc-300",
                )}
              >
                {glyph}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
