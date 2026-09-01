import { cn } from "@/lib/utils";

/** Shared pill track for settings / pricing segmented controls. */
export const segmentedTrackClass =
  "inline-flex rounded-lg bg-[var(--settings-icon-bg)] p-0.5";

/** Text or icon pill — active state has no global hover washout. */
export function segmentedOptionClass(
  active: boolean,
  size: "sm" | "icon" = "sm",
) {
  const base = cn(
    "no-hover-overlay font-medium transition-colors",
    size === "icon"
      ? "inline-flex h-7 w-8 items-center justify-center rounded-[5px]"
      : "h-7 rounded-[5px] px-2.5 text-[13px] leading-[18px]",
  );
  return cn(
    base,
    active
      ? "bg-[var(--settings-elevated-bg,#ffffff)] text-[var(--settings-fg,#18181b)] shadow-[inset_0_0_0_1px_var(--settings-hairline)]"
      : "text-[var(--settings-fg-muted,rgba(24,24,27,0.74))] hover:text-[var(--settings-fg,#18181b)]",
  );
}

/** Pricing / onboarding plan switcher pills. */
export function subscriptionSegmentClass(active: boolean) {
  return cn(
    "no-hover-overlay relative z-[1] cursor-pointer rounded-full px-5 py-2.5 text-[13px] font-medium leading-4 transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pricing-fg)]/30",
    active
      ? "bg-[var(--pricing-card)] text-[var(--pricing-fg)] shadow-[0_1px_3px_rgba(20,21,26,0.16),inset_0_0_0_1px_rgba(20,21,26,0.06)]"
      : "text-[var(--pricing-muted)] hover:bg-[var(--pricing-card)]/55 hover:text-[var(--pricing-fg)]",
  );
}

/** Track around Monthly/Yearly and Individual/Team switches. */
export const subscriptionSegmentTrackClass =
  "relative inline-flex rounded-full bg-[var(--pricing-toggle-track)] p-1 shadow-[inset_0_1px_2px_rgba(20,21,26,0.08)]";
