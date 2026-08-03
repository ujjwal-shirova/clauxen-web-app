"use client";

import { Files } from "lucide-react";
import { HintTooltip } from "./ui/hint-tooltip";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex shrink-0 items-center justify-end gap-1.5", className)}>
      {onToggleArtifactsPanel ? (
        <HintTooltip content="Artifacts">
          <button
            type="button"
            onClick={onToggleArtifactsPanel}
            aria-label="Toggle artifacts panel"
            aria-pressed={isArtifactsPanelOpen}
            className={cn(
              "ui-icon-button rounded-md border transition-all",
              suppressArtifactsHover && "no-hover no-hover-overlay",
              isArtifactsPanelOpen
                ? "border-zinc-200 bg-zinc-100 text-zinc-800"
                : suppressArtifactsHover
                  ? "border-transparent bg-transparent text-zinc-700 hover:border-transparent hover:bg-transparent"
                  : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-100",
            )}
          >
            <Files className="size-4" strokeWidth={1.75} />
          </button>
        </HintTooltip>
      ) : null}
      {onShareClick ? (
        <HintTooltip content="Share chat">
          <button
            type="button"
            onClick={onShareClick}
            aria-label="Share chat"
            className={cn(
              "inline-flex h-7 min-w-[52px] items-center justify-center rounded-md border border-zinc-200/90 bg-white px-2.5 text-[12px] font-medium leading-4 text-zinc-800 transition-colors hover:bg-zinc-50",
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
