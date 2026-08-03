"use client";

import type { ReactNode } from "react";
import { ClauxenWordmark } from "./clauxen-wordmark";
import { cn } from "@/lib/utils";

type OnboardingShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function OnboardingShell({
  children,
  footer,
  className,
  contentClassName,
}: OnboardingShellProps) {
  return (
    <div
      className={cn(
        "flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--app-shell-bg,#f9f9f9)] font-sans text-zinc-900",
        className,
      )}
    >
      <div className="flex shrink-0 justify-center pt-8 md:pt-10">
        <ClauxenWordmark />
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-4 py-8 md:py-10",
          contentClassName,
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="flex shrink-0 flex-col items-center px-4 pb-8 md:pb-10">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
