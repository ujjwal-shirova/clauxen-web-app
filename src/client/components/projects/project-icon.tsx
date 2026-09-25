"use client";

import { useState } from "react";
import {
  BookOpen,
  Brain,
  Briefcase,
  Code2,
  DollarSign,
  Dumbbell,
  FlaskConical,
  Flower2,
  Folder,
  Globe,
  GraduationCap,
  Heart,
  Music,
  Palette,
  PawPrint,
  PenLine,
  PenTool,
  Plane,
  Popcorn,
  Scale,
  Scissors,
  Sprout,
  Stethoscope,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectIcon } from "@/lib/project-drafts";
import { cn } from "@/lib/utils";

export const PROJECT_COLORS = [
  "#14151a",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export const PROJECT_ICON_SET: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "folder", label: "Folder", icon: Folder },
  { id: "dollar", label: "Money", icon: DollarSign },
  { id: "book", label: "Book", icon: BookOpen },
  { id: "school", label: "School", icon: GraduationCap },
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "nib", label: "Nib", icon: PenTool },
  { id: "code", label: "Code", icon: Code2 },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "music", label: "Music", icon: Music },
  { id: "popcorn", label: "Popcorn", icon: Popcorn },
  { id: "cut", label: "Cut", icon: Scissors },
  { id: "art", label: "Art", icon: Palette },
  { id: "health", label: "Health", icon: Stethoscope },
  { id: "flower", label: "Flower", icon: Flower2 },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "scale", label: "Scale", icon: Scale },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "plane", label: "Travel", icon: Plane },
  { id: "wrench", label: "Tools", icon: Wrench },
  { id: "paw", label: "Pet", icon: PawPrint },
  { id: "lab", label: "Lab", icon: FlaskConical },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "plant", label: "Plant", icon: Sprout },
  { id: "train", label: "Training", icon: Dumbbell },
];

const byId = new Map(PROJECT_ICON_SET.map((item) => [item.id, item]));

export function ProjectMark({
  icon,
  className,
  glyphClassName,
}: {
  icon: ProjectIcon;
  className?: string;
  glyphClassName?: string;
}) {
  const preset = byId.get(icon.id) ?? PROJECT_ICON_SET[0];
  const Icon = preset.icon;
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ color: icon.color }}
    >
      <Icon className={glyphClassName ?? "size-5"} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = [r, g, b]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

export function ProjectIconPicker({
  icon,
  onChange,
  triggerClassName,
  glyphClassName,
}: {
  icon: ProjectIcon;
  onChange: (icon: ProjectIcon) => void;
  triggerClassName?: string;
  glyphClassName?: string;
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
          aria-label="Choose project icon"
          className={cn(
            "inline-flex items-center justify-center rounded-lg text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)]",
            triggerClassName,
          )}
        >
          <ProjectMark icon={icon} glyphClassName={glyphClassName} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[280px] rounded-2xl border-[var(--ui-border)] bg-[var(--ui-field-bg)] p-3 text-[var(--ui-fg)] shadow-lg"
      >
        <div className="grid grid-cols-6 gap-2 px-1">
          {PROJECT_COLORS.map((color) => {
            const selected = icon.color.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => onChange({ ...icon, color })}
                className={cn(
                  "size-7 rounded-full",
                  selected && "ring-2 ring-[var(--ui-fg)] ring-offset-2 ring-offset-[var(--ui-field-bg)]",
                )}
                style={{ background: color }}
              />
            );
          })}
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left text-[13px] hover:bg-[var(--ui-hover-wash)]"
          onClick={() => setCustomOpen((value) => !value)}
        >
          <span
            className="size-5 rounded-full"
            style={{ background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)` }}
          />
          <span className="flex-1">Custom color</span>
          <span className="text-[var(--ui-fg-muted)]">{customOpen ? "▴" : "▾"}</span>
        </button>
        {customOpen ? (
          <div className="mt-2 px-1">
            <button
              type="button"
              aria-label="Pick custom color"
              className="relative h-24 w-full overflow-hidden rounded-xl"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
              }}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const nextSat = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                const nextVal = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
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
            <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ui-fg-muted)]">
              Hex
              <input
                value={icon.color}
                onChange={(event) => {
                  const next = event.target.value;
                  if (/^#([0-9a-fA-F]{0,6})$/.test(next)) onChange({ ...icon, color: next });
                }}
                className="h-8 flex-1 rounded-lg border border-[var(--ui-border)] bg-transparent px-2 text-[13px] text-[var(--ui-fg)] outline-none"
              />
            </label>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-6 gap-1 border-t border-[var(--ui-border-subtle)] pt-3">
          {PROJECT_ICON_SET.map((preset) => {
            const selected = icon.id === preset.id;
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onChange({ ...icon, id: preset.id })}
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)]",
                  selected && "bg-[var(--ui-hover-wash)]",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-2 w-full border-t border-[var(--ui-border-subtle)] px-1 pt-2 text-left text-[13px] text-[var(--ui-fg)]"
          onClick={() => setOpen(false)}
        >
          Done
        </button>
      </PopoverContent>
    </Popover>
  );
}
