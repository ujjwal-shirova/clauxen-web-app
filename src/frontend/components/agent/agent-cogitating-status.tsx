"use client";

import { cn } from "@/frontend/lib/utils";
import { COGITATING_LABEL } from "@/frontend/lib/clauxen-code/spinner-verbs";

/** Orange multi-point spark — Anthropic-style live thinking affordance. */
export function AgentSparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0", className)}
    >
      <path d="M8 0.6c.28 0 .5.2.56.47l.7 3.2a1.2 1.2 0 0 0 .9.9l3.2.7c.27.06.47.28.47.56s-.2.5-.47.56l-3.2.7a1.2 1.2 0 0 0-.9.9l-.7 3.2c-.06.27-.28.47-.56.47s-.5-.2-.56-.47l-.7-3.2a1.2 1.2 0 0 0-.9-.9l-3.2-.7C1.5 8.5 1.3 8.28 1.3 8s.2-.5.47-.56l3.2-.7a1.2 1.2 0 0 0 .9-.9l.7-3.2C7.5.8 7.72.6 8 .6Z" />
    </svg>
  );
}

/** Live "Cogitating" status — spark + muted label with shimmer. */
export function AgentCogitatingStatus({
  label = COGITATING_LABEL,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2 inline-flex items-center gap-2 text-[13.5px] font-medium leading-5 text-zinc-500",
        className,
      )}
      data-agent-status="cogitating"
      aria-live="polite"
    >
      <AgentSparkIcon className="text-[#f97316]" />
      <span className="shimmer-text">{label}</span>
    </div>
  );
}
