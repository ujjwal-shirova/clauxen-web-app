"use client";

import { useState } from "react";
import { Check } from "@/components/icons/app-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProjectIcon } from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, PROJECT_GLYPHS, projectGlyph } from "./project-glyphs";

export { PROJECT_COLORS, PROJECT_GLYPHS } from "./project-glyphs";

export const DEFAULT_PROJECT_ICON: ProjectIcon = {
  id: "folder",
  color: "#14151a",
};

/**
 * The project glyph on its tinted plate. `color` drives both the glyph and a
 * low-alpha wash of the same hue, so a project reads as one colour chip
 * instead of a glyph floating on grey.
 */
export function ProjectMark({
  icon,
  size = "md",
  className,
}: {
  icon: ProjectIcon;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const Glyph = projectGlyph(icon.id).icon;
  const plate = {
    sm: "size-7 rounded-lg text-[15px]",
    md: "size-9 rounded-xl text-[19px]",
    lg: "size-11 rounded-[14px] text-[23px]",
    xl: "size-14 rounded-2xl text-[29px]",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        plate,
        className,
      )}
      style={{
        color: icon.color,
        background: `color-mix(in srgb, ${icon.color} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${icon.color} 18%, transparent)`,
      }}
    >
      <Glyph />
    </span>
  );
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

export function ProjectIconPicker({
  icon,
  onChange,
  size = "md",
  className,
}: {
  icon: ProjectIcon;
  onChange: (icon: ProjectIcon) => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [hue, setHue] = useState(220);
  const [sat, setSat] = useState(0.7);
  const [val, setVal] = useState(0.9);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose project icon and colour"
          className={cn(
            "rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-ring)]",
            className,
          )}
        >
          <ProjectMark icon={icon} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[292px] rounded-2xl border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-3 text-[var(--ui-fg)] shadow-xl"
      >
        <p className="px-1 pb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ui-fg-subtle)]">
          Colour
        </p>
        <div className="grid grid-cols-10 gap-1.5 px-1">
          {PROJECT_COLORS.map((color) => {
            const selected = icon.color.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={selected}
                onClick={() => onChange({ ...icon, color })}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-white",
                  selected &&
                    "ring-2 ring-[var(--ui-fg)] ring-offset-2 ring-offset-[var(--ui-card-bg)]",
                )}
                style={{ background: color }}
              >
                {selected ? <Check className="text-[12px]" /> : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-expanded={customOpen}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[13px] hover:bg-[var(--ui-hover-wash)]"
          onClick={() => setCustomOpen((value) => !value)}
        >
          <span
            className="size-5 rounded-full"
            style={{
              background:
                "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
            }}
          />
          <span className="flex-1">Custom colour</span>
        </button>
        {customOpen ? (
          <div className="mt-1 px-1">
            <button
              type="button"
              aria-label="Pick saturation and brightness"
              className="relative h-20 w-full overflow-hidden rounded-xl"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
              }}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const nextSat = Math.min(
                  1,
                  Math.max(0, (event.clientX - rect.left) / rect.width),
                );
                const nextVal = Math.min(
                  1,
                  Math.max(0, 1 - (event.clientY - rect.top) / rect.height),
                );
                setSat(nextSat);
                setVal(nextVal);
                onChange({ ...icon, color: hsvToHex(hue, nextSat, nextVal) });
              }}
            >
              <span
                className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }}
              />
            </button>
            <input
              aria-label="Hue"
              type="range"
              min={0}
              max={360}
              value={hue}
              onChange={(event) => {
                const next = Number(event.target.value);
                setHue(next);
                onChange({ ...icon, color: hsvToHex(next, sat, val) });
              }}
              className="mt-2 w-full accent-[var(--ui-fg)]"
            />
          </div>
        ) : null}

        <p className="mt-3 border-t border-[var(--ui-border-subtle)] px-1 pb-2 pt-3 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ui-fg-subtle)]">
          Icon
        </p>
        <div className="grid max-h-[180px] grid-cols-7 gap-1 overflow-y-auto px-1">
          {PROJECT_GLYPHS.map((preset) => {
            const selected = projectGlyph(icon.id).id === preset.id;
            const Glyph = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onChange({ ...icon, id: preset.id })}
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl text-[18px] text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
                  selected && "bg-[var(--ui-hover-wash)]",
                )}
                style={selected ? { color: icon.color } : undefined}
              >
                <Glyph />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
