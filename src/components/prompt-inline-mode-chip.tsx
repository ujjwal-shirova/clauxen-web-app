"use client";

import { Globe, ImageIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptInlineMode = "web-search" | "create-image";

const INLINE_MODE_META: Record<
  PromptInlineMode,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  "web-search": {
    label: "Web search",
    icon: Globe,
    colorClass: "text-[#3a83f7]",
  },
  "create-image": {
    label: "Create image",
    icon: ImageIcon,
    colorClass: "text-violet-500",
  },
};

export function PromptInlineModeChip({ mode }: { mode: PromptInlineMode }) {
  const meta = INLINE_MODE_META[mode];
  const Icon = meta.icon;

  return (
    <span
      contentEditable={false}
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1 px-1",
        meta.colorClass,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="max-w-[256px] truncate whitespace-nowrap text-[15px] font-normal leading-[26px] sm:text-[16px]">
        {meta.label}
      </span>
    </span>
  );
}
