"use client";

import { cn } from "@/lib/utils";
import {
  projectBoundaryColor,
  resolveProjectColor,
  resolveProjectIcon,
} from "@/lib/project-appearance";

type ProjectAvatarProps = {
  icon?: string | null;
  color?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  xs: "h-5 w-5 text-[11px]",
  sm: "h-8 w-8 text-[15px]",
  md: "h-10 w-10 text-[18px]",
  lg: "h-20 w-20 text-[32px]",
} as const;

export function ProjectAvatar({
  icon,
  color,
  name,
  size = "md",
  className,
}: ProjectAvatarProps) {
  const fill = resolveProjectColor(color);
  const glyph = resolveProjectIcon(icon);

  return (
    <span
      aria-hidden={!name}
      aria-label={name ? `${name} project icon` : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
        SIZE_CLASS[size],
        className,
      )}
      style={{
        backgroundColor: fill,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 1.5px ${projectBoundaryColor(fill)}`,
      }}
    >
      <span className="leading-none">{glyph}</span>
    </span>
  );
}
