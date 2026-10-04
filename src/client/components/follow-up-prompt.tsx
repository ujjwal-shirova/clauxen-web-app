"use client";

import * as React from "react";
import { ArrowUpRight, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFollowUpPrompt } from "@/contexts/follow-up-prompt-context";

type FollowUpPromptProps = {
  prompt: string;
  className?: string;
  /**
   * `inline` — link-style prompt embedded in markdown prose.
   * `row` — full-width suggestion row used in the post-answer follow-up list.
   */
  variant?: "inline" | "row";
};

/** Clickable follow-up that sends `prompt` as the next user message. */
export function FollowUpPrompt({
  prompt,
  className,
  variant = "inline",
}: FollowUpPromptProps) {
  const { enabled, onSelect } = useFollowUpPrompt();
  const text = prompt.trim();
  if (!text) return null;

  if (!enabled || !onSelect) {
    return <span className={className}>{text}</span>;
  }

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(text);
  };

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "follow-up-row group flex w-full flex-row items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 no-hover-overlay",
          className,
        )}
        aria-label={`Send follow-up: ${text}`}
      >
        <span className="flex min-w-0 flex-1 flex-row items-center gap-2.5">
          <CornerDownRight
            aria-hidden="true"
            className="follow-up-row__lead h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
            strokeWidth={1.75}
          />
          <span className="follow-up-row__label flex-1 truncate text-[13.5px] font-normal text-zinc-700 transition-colors group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-zinc-100">
            {text}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="follow-up-row__trail h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 dark:text-zinc-500"
          strokeWidth={2}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "follow-up-prompt inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[13px] font-normal text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 no-hover-overlay",
        className,
      )}
      aria-label={`Send follow-up: ${text}`}
    >
      <span aria-hidden="true" className="text-zinc-400">→</span>
      <span className="underline decoration-zinc-300 underline-offset-4 dark:decoration-zinc-700">
        {text}
      </span>
    </button>
  );
}
