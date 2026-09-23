import { cn } from "@/lib/utils";

export const APP_SIDEBAR_RAIL_WIDTH_PX = 48;
/** Expanded primary nav width. */
export const APP_SIDEBAR_EXPANDED_WIDTH_PX = 256;
export const APP_SHELL_GAP = "0.625rem";

/** Shared main-content shell — full-bleed, no contained-panel inset. */
export function appMainShellClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  // `fullBleed` is kept in the signature for call-site compatibility; the
  // main content is now always full-bleed.
  void options.fullBleed;

  return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))] p-0";
}

export function appAgentPanelClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  // `fullBleed` is kept in the signature for call-site compatibility; the
  // panel is now always edge-to-edge (no rounded floating card).
  void options.fullBleed;

  if (options.isMobile) {
    return "app-agent-panel agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
  }

  return "app-agent-panel agent-panel relative flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
}

export function appShellRootClassName(isMobile: boolean) {
  return cn(
    "app-shell-root relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))] font-sans text-zinc-800",
    !isMobile && "flex-row",
  );
}
