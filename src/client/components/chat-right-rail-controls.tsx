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
        "flex shrink-0 items-center justify-end gap-0.5 sm:gap-1.5",
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
              "ui-icon-button rounded-lg border transition-all max-[360px]:hidden",
              isArtifactsPanelOpen
                ? "border-zinc-200 bg-zinc-100 text-zinc-800"
                : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            <PanelRight className="size-[18px]" strokeWidth={1.8} />
          </button>
        </HintTooltip>
      ) : null}
    </div>
  );
}
