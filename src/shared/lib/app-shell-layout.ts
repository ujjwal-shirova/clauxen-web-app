import { cn } from "@/lib/utils";

export const APP_SIDEBAR_RAIL_WIDTH_PX = 48;
/** Expanded primary nav width. */
export const APP_SIDEBAR_EXPANDED_WIDTH_PX = 240;
export const APP_SHELL_GAP = "0.625rem";

/**
 * Shared main-content shell. Desktop keeps the reference's warm canvas with a
 * floating white conversation sheet; mobile stays edge-to-edge.
 */
export function appMainShellClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  void options.fullBleed;

  if (options.isMobile) {
    return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg,#ffffff)] p-0";
  }

  return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg,#fbfaf9)] py-2 pr-2 pl-0";
}

export function appAgentPanelClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  void options.fullBleed;

  if (options.isMobile) {
    return "app-agent-panel agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
  }

  return "app-agent-panel agent-panel relative flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] rounded-[16px] border border-black/[0.07] shadow-[0_1px_3px_rgba(20,21,26,0.04)] dark:border-white/[0.07] dark:shadow-none [transform:translateZ(0)]";
}

export function appShellRootClassName(isMobile: boolean) {
  return cn(
    "app-shell-root relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg,var(--app-sidebar-bg))] font-sans text-zinc-800",
    !isMobile && "flex-row",
  );
}
