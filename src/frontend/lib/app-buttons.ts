import { cn } from "@/frontend/lib/utils";

/** Canonical class strings for app-wide button variants (see styles/app-buttons.css). */
export const appBtn = {
  base: "app-btn no-hover-overlay",
  primary: "app-btn app-btn-primary app-btn-md no-hover-overlay",
  primaryLg: "app-btn app-btn-primary app-btn-lg no-hover-overlay w-full",
  primaryLgAuto: "app-btn app-btn-primary app-btn-lg no-hover-overlay",
  primarySm: "app-btn app-btn-primary app-btn-sm no-hover-overlay",
  secondary: "app-btn app-btn-secondary app-btn-md",
  secondarySm: "app-btn app-btn-secondary app-btn-sm",
  ghost: "app-btn app-btn-ghost app-btn-md",
  ghostIcon: "app-btn app-btn-ghost app-btn-icon",
} as const;

export function appButtonClass(
  variant:
    | keyof typeof appBtn
    | "primary"
    | "secondary"
    | "ghost"
    | "ghostIcon",
  extra?: string,
) {
  const key =
    variant === "primary"
      ? "primary"
      : variant === "secondary"
        ? "secondary"
        : variant === "ghost"
          ? "ghost"
          : variant === "ghostIcon"
            ? "ghostIcon"
            : variant;
  return cn(appBtn[key], extra);
}
