"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileMenuButtonProps {
  onClick: () => void;
  className?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
}

export function MobileMenuButton({
  onClick,
  className,
  "aria-controls": ariaControls,
  "aria-expanded": ariaExpanded,
}: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      aria-label="Open navigation menu"
      aria-expanded={ariaExpanded ?? false}
      aria-controls={ariaControls}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-200/70 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors hover:border-zinc-300/80 hover:bg-zinc-50 lg:hidden",
        className,
      )}
    >
      <Menu className="h-[15px] w-[15px] stroke-[2.25]" aria-hidden />
    </button>
  );
}
