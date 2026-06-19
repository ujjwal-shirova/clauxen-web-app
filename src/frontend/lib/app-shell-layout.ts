import { cn } from "@/frontend/lib/utils";

export const APP_SIDEBAR_RAIL_WIDTH_PX = 48;
export const APP_SIDEBAR_EXPANDED_WIDTH_PX = 210;
export const APP_SHELL_GAP = "0.5rem";

/** Shared main-content inset — uniform padding; sidebar sits in the flex row beside main. */
export function appMainShellClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  const { isMobile, fullBleed = false } = options;

  if (isMobile && fullBleed) {
    return "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)] p-0";
  }

  if (isMobile) {
    return cn(
      "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)]",
      "px-[max(0.625rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:px-2 sm:pt-2 sm:pb-2",
    );
  }

  return cn(
    "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)]",
    "p-2",
  );
}

export function appAgentPanelClassName(options: {
  isMobile: boolean;
  fullBleed?: boolean;
}) {
  const { isMobile, fullBleed = false } = options;

  if (isMobile && fullBleed) {
    return "agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] rounded-none border-0 shadow-none [transform:translateZ(0)]";
  }

  if (isMobile) {
    return cn(
      "agent-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] min-h-[100dvh] [transform:translateZ(0)]",
      "rounded-[14px] border border-zinc-200/80 shadow-[0_1px_3px_rgba(24,24,27,0.04),0_8px_24px_-8px_rgba(24,24,27,0.06)]",
    );
  }

  return cn(
    "agent-panel relative flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] [transform:translateZ(0)]",
    fullBleed
      ? "min-h-[100dvh] rounded-none border-0 shadow-none"
      : "rounded-[16px] border border-zinc-200/80 shadow-[0_1px_3px_rgba(24,24,27,0.04),0_8px_24px_-8px_rgba(24,24,27,0.06)] sm:rounded-[18px]",
  );
}

export function appShellRootClassName(isMobile: boolean) {
  return cn(
    "relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] font-sans text-zinc-800",
    !isMobile && "flex-row",
  );
}
