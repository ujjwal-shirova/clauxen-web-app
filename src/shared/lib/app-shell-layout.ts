import { cn } from "@/lib/utils";

export const APP_SIDEBAR_RAIL_WIDTH_PX = 48;
/** Expanded primary nav width. */
export const APP_SIDEBAR_EXPANDED_WIDTH_PX = 264;
export const APP_SHELL_GAP = "0.625rem";

/** Shared main-content shell — containerized on desktop with pure white surface. */
export function appMainShellClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  if (options.isMobile || options.fullBleed) {
    return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950 p-0";
  }

  return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 pl-0 bg-[#f4f5f7] dark:bg-zinc-950";
}

export function appAgentPanelClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  if (options.isMobile || options.fullBleed) {
    return "app-agent-panel agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900 min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
  }

  return "app-agent-panel agent-panel relative flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900 rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.03)] [transform:translateZ(0)]";
}

export function appShellRootClassName(isMobile: boolean) {
  return cn(
    "app-shell-root relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#f4f5f7] dark:bg-zinc-950 font-sans text-zinc-800",
    !isMobile && "flex-row",
  );
}
