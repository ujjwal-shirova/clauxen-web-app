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
        "ui-icon-button relative z-30 shrink-0 touch-manipulation text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] lg:hidden",
        className,
      )}
    >
      <Menu className="size-[18px] stroke-[1.75]" aria-hidden />
    </button>
  );
}
