import { cn } from "@/frontend/lib/utils";

/** Shared pill track for settings / pricing segmented controls. */
export const segmentedTrackClass =
  "inline-flex rounded-lg bg-zinc-100/90 p-0.5";

/** Text or icon pill — active state has no global hover washout. */
export function segmentedOptionClass(
  active: boolean,
  size: "sm" | "icon" = "sm",
) {
  const base = cn(
    "no-hover-overlay font-medium transition-colors",
    size === "icon"
      ? "inline-flex h-8 w-9 items-center justify-center rounded-md"
      : "h-8 rounded-md px-3 text-[13px]",
  );
  return cn(
    base,
    active
      ? "bg-white text-zinc-900 shadow-sm"
      : "text-zinc-500 hover:text-zinc-800",
  );
}

/** Pricing / onboarding plan switcher pills. */
export function subscriptionSegmentClass(active: boolean) {
  return cn(
    "no-hover-overlay rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
    active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900",
  );
}
