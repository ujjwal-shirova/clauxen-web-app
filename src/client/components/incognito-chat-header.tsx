"use client";

import { X } from "lucide-react";
import { GhostChatIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type IncognitoChatHeaderProps = {
  onClose: () => void;
  className?: string;
};

/**
 * Full-width black strip for Incognito mode — replaces chat title / share chrome
 * and sits above the panel while the app sidebar is hidden.
 */
export function IncognitoChatHeader({
  onClose,
  className,
}: IncognitoChatHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-10 w-full shrink-0 items-center justify-between gap-3 bg-zinc-950 px-3 text-white sm:h-11 sm:px-4",
        className,
      )}
      data-incognito-header
    >
      <div className="flex min-w-0 items-center gap-2">
        <GhostChatIcon className="h-4 w-4 shrink-0 text-white" />
        <span className="truncate text-[13.5px] font-medium leading-none tracking-[-0.01em]">
          Incognito chat
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Incognito chat"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </header>
  );
}
