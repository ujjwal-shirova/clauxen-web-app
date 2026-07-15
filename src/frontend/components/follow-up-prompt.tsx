"use client";

import * as React from "react";
import { cn } from "@/frontend/lib/utils";
import { useFollowUpPrompt } from "@/frontend/contexts/follow-up-prompt-context";

type FollowUpPromptProps = {
  prompt: string;
  className?: string;
};

/**
 * Clickable follow-up action — arrow + dotted underline (see product mock).
 * Sends the prompt as the next user message when selected.
 */
export function FollowUpPrompt({ prompt, className }: FollowUpPromptProps) {
  const { enabled, onSelect } = useFollowUpPrompt();
  const text = prompt.trim();
  if (!text) return null;

  if (!enabled || !onSelect) {
    return <span className={className}>{text}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(text);
      }}
      className={cn(
        "follow-up-prompt group inline-flex max-w-full items-baseline gap-1.5 text-left font-[430] text-[14px] leading-[1.55] text-zinc-800",
        "transition-colors hover:text-blue-600",
        "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        className,
      )}
      aria-label={`Send follow-up: ${text}`}
    >
      <span
        aria-hidden
        className="follow-up-prompt__arrow shrink-0 text-[15px] leading-none text-zinc-500 transition-colors group-hover:text-blue-600"
      >
        →
      </span>
      <span className="follow-up-prompt__label min-w-0 underline decoration-zinc-300 decoration-dotted underline-offset-[5px] transition-colors group-hover:decoration-blue-400">
        {text}
      </span>
    </button>
  );
}
