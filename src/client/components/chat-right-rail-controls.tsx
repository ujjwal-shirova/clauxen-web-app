"use client";

import type { ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { HintTooltip } from "./ui/hint-tooltip";
import { cn } from "@/lib/utils";

type ChatRightRailControlsProps = {
  isArtifactsPanelOpen?: boolean;
  onToggleArtifactsPanel?: () => void;
  className?: string;
  menu?: ReactNode;
};

export function ChatRightRailControls({
  isArtifactsPanelOpen = false,
  onToggleArtifactsPanel,
  className,
  menu,
}: ChatRightRailControlsProps) {
  return (
    <div
      className={cn(
        "flex h-full shrink-0 items-center justify-end gap-1",
        className,
      )}
    >
      {menu}
      {onToggleArtifactsPanel ? (
        <HintTooltip content="Toggle right sidebar">
          <button
            type="button"
            onClick={onToggleArtifactsPanel}
            aria-label="Toggle right sidebar"
            aria-pressed={isArtifactsPanelOpen}
            className={cn(
              "ui-icon-button shrink-0 rounded-lg transition-colors",
              isArtifactsPanelOpen
                ? "bg-[var(--brand-soft)] text-[var(--ui-fg)]"
                : "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
            )}
          >
            <PanelRight className="size-[18px]" strokeWidth={1.8} />
          </button>
        </HintTooltip>
      ) : null}
    </div>
  );
}
