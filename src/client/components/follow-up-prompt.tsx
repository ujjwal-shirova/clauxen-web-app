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
        className={cn("follow-up-row no-hover-overlay group", className)}
        aria-label={`Send follow-up: ${text}`}
      >
        <CornerDownRight
          aria-hidden
          className="follow-up-row__lead"
          strokeWidth={1.75}
        />
        <span className="follow-up-row__label">{text}</span>
        <ArrowUpRight
          aria-hidden
          className="follow-up-row__trail"
          strokeWidth={1.9}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "follow-up-prompt label-hover-bold no-hover-overlay group inline-flex max-w-full items-baseline gap-1.5 bg-transparent p-0 text-left font-[430] text-[13px] leading-[18px] text-[var(--ui-fg-muted)]",
        "hover:text-[var(--ui-fg)]",
        "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        className,
      )}
      aria-label={`Send follow-up: ${text}`}
    >
      <span
        aria-hidden
        className="follow-up-prompt__arrow shrink-0 text-[15px] leading-none text-blue-500/80 transition-colors group-hover:text-blue-600"
      >
        →
      </span>
      <span className="follow-up-prompt__label min-w-0 underline decoration-blue-400/50 decoration-dotted underline-offset-[5px] transition-[color,text-decoration-color] group-hover:decoration-blue-500">
        {text}
      </span>
    </button>
  );
}
