import { cn } from "@/lib/utils";

export const APP_SIDEBAR_RAIL_WIDTH_PX = 48;
/** Expanded primary nav width. */
export const APP_SIDEBAR_EXPANDED_WIDTH_PX = 288;
export const APP_SHELL_GAP = "0.625rem";

/** Shared main-content inset — the panel sits as a contained surface in sidebar-colored shell space. */
export function appMainShellClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  const { isMobile, fullBleed = false } = options;

  if (isMobile && fullBleed) {
    return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))] p-0";
  }

  if (isMobile) {
    return cn(
      "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))]",
      "px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.35rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-2.5 sm:pt-2.5 sm:pb-2.5",
    );
  }

  if (fullBleed) {
    return "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))] p-0";
  }

  return cn(
    "app-main-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))]",
    "p-2 transition-[padding] duration-300 ease-in-out",
  );
}

export function appAgentPanelClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  const { isMobile, fullBleed = false } = options;

  if (isMobile && fullBleed) {
    return "app-agent-panel agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
  }

  if (isMobile) {
    return cn(
      "app-agent-panel agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] [transform:translateZ(0)]",
      "rounded-[var(--radius-lg)] border border-b-0 border-zinc-200/80 shadow-[var(--panel-shadow)]",
    );
  }

  return cn(
    "app-agent-panel agent-panel relative flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] [transform:translateZ(0)]",
    fullBleed
      ? "min-h-[100dvh] rounded-none border-0 shadow-none"
      : "rounded-[18px] border border-black/[0.08] shadow-[0_10px_34px_rgba(28,25,23,0.055)] dark:border-white/[0.08] dark:shadow-[0_12px_38px_rgba(0,0,0,0.24)]",
  );
}

export function appShellRootClassName(isMobile: boolean) {
  return cn(
    "app-shell-root relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-sidebar-bg,var(--app-shell-bg))] font-sans text-zinc-800",
    !isMobile && "flex-row",
  );
}
