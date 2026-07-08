"use client";

import { HintTooltip } from "./ui/hint-tooltip";
import { cn } from "@/frontend/lib/utils";

function ArtifactsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.586 2a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V16.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.492-1.347L4 16.5v-13A1.5 1.5 0 0 1 5.5 2zM5.5 3a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V7h-2.5A1.5 1.5 0 0 1 11 5.5V3zm7.04 10.304a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696m0-4a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696M12 5.5a.5.5 0 0 0 .5.5h2.293L12 3.207z" />
    </svg>
  );
}

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
            <ArtifactsIcon />
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
