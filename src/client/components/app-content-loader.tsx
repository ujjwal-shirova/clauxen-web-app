import { LoaderCircle } from "lucide-react";

export function AppContentLoader({
  label = "Loading",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 w-full flex-1 items-center justify-center ${className}`}
      role="status"
      aria-label={label}
    >
      <LoaderCircle
        className="size-6 animate-spin text-[var(--ui-fg-muted)]"
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
