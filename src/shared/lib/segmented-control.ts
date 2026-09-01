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

/** Pricing / onboarding plan switcher pills — same chrome as settings. */
export function subscriptionSegmentClass(active: boolean) {
  return segmentedOptionClass(active);
}

/** Track around Monthly/Yearly and Individual/Team switches. */
export const subscriptionSegmentTrackClass = segmentedTrackClass;
