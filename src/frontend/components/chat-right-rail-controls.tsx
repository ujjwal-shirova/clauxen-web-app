"use client";

import { FileStack } from "lucide-react";
import { HintTooltip } from "./ui/hint-tooltip";
import { cn } from "@/frontend/lib/utils";

type ChatRightRailControlsProps = {
  isArtifactsPanelOpen?: boolean;
  onToggleArtifactsPanel?: () => void;
  onShareClick?: () => void;
  className?: string;
  shareClassName?: string;
  suppressArtifactsHover?: boolean;
};

export function ChatRightRailControls({
  isArtifactsPanelOpen = false,
  onToggleArtifactsPanel,
  onShareClick,
  className,
  shareClassName,
  suppressArtifactsHover = false,
}: ChatRightRailControlsProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-2", className)}>
      {onToggleArtifactsPanel ? (
        <HintTooltip content="Artifacts">
          <button
            type="button"
            onClick={onToggleArtifactsPanel}
            aria-label="Toggle artifacts panel"
            aria-pressed={isArtifactsPanelOpen}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-all",
              suppressArtifactsHover && "no-hover no-hover-overlay",
              isArtifactsPanelOpen
                ? "border-zinc-200 bg-zinc-100 text-zinc-800"
                : suppressArtifactsHover
                  ? "border-transparent bg-transparent text-zinc-700 hover:border-transparent hover:bg-transparent"
                  : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-100",
            )}
          >
            <FileStack className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </HintTooltip>
      ) : null}
      {onShareClick ? (
        <HintTooltip content="Share chat">
          <button
            type="button"
            onClick={onShareClick}
            className={cn(
              "inline-flex h-8 min-w-[56px] items-center justify-center rounded-[10px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-800 transition-all hover:bg-zinc-50",
              shareClassName,
            )}
          >
            Share
          </button>
        </HintTooltip>
      ) : null}
    </div>
  );
}
