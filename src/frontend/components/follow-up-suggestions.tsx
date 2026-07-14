"use client";

const DEFAULT_FOLLOW_UPS = [
  "Tell me more",
  "Explain that differently",
  "Give a concrete example",
] as const;

type FollowUpSuggestionsProps = {
  onSelect: (prompt: string) => void;
  suggestions?: readonly string[];
  className?: string;
};

/** Post-response chips gated by Settings → Follow-up suggestions. */
export function FollowUpSuggestions({
  onSelect,
  suggestions = DEFAULT_FOLLOW_UPS,
  className,
}: FollowUpSuggestionsProps) {
  return (
    <div
      className={
        className ??
        "follow-up-suggestions mt-3 flex w-full flex-wrap gap-1.5 font-sans"
      }
      role="group"
      aria-label="Suggested follow-ups"
    >
      {suggestions.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
