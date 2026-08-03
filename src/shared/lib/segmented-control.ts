import { cn } from "@/lib/utils";

/** Shared pill track for settings / pricing segmented controls. */
export const segmentedTrackClass =
  "inline-flex rounded-md bg-[color-mix(in_oklab,#18181b_6%,transparent)] p-0.5";

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
      ? "bg-[var(--settings-card-bg,#ffffff)] text-[var(--settings-fg,#18181b)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,#18181b_8%,transparent)]"
      : "text-[var(--settings-fg-muted,rgba(24,24,27,0.74))] hover:text-[var(--settings-fg,#18181b)]",
  );
}

/** Pricing / onboarding plan switcher pills. */
export function subscriptionSegmentClass(active: boolean) {
  return cn(
    "no-hover-overlay relative z-[1] rounded-full px-5 py-2.5 text-[13px] font-medium leading-4 transition-colors duration-150",
    active
      ? "text-[var(--pricing-fg)]"
      : "text-[var(--pricing-muted)] hover:text-[var(--pricing-fg)]",
  );
}

/** Track around Monthly/Yearly and Individual/Team switches. */
export const subscriptionSegmentTrackClass =
  "relative inline-flex rounded-full bg-[var(--pricing-toggle-track)] p-0.5";
