"use client";

import type { ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";
import { MobileMenuButton } from "@/frontend/components/mobile-menu-button";

type ProjectsMobileHeaderProps = {
  title?: string;
  subtitle?: string;
  onOpenMobileNav?: () => void;
  showMenu?: boolean;
  isNavOpen?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  borderless?: boolean;
};

export function ProjectsMobileHeader({
  title,
  subtitle,
  onOpenMobileNav,
  showMenu = true,
  isNavOpen = false,
  leading,
  trailing,
  className,
  borderless = false,
}: ProjectsMobileHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 shrink-0 bg-white",
        !borderless && "border-b border-zinc-100",
        className,
      )}
    >
      <div className="flex min-h-[48px] items-center gap-2 px-3 pt-[max(0.25rem,env(safe-area-inset-top))] pb-2 sm:px-4">
        <div className="flex min-w-[2.25rem] shrink-0 items-center justify-start">
          {leading ??
            (showMenu && onOpenMobileNav ? (
              <MobileMenuButton
                onClick={onOpenMobileNav}
                aria-controls="projects-primary-nav"
                aria-expanded={isNavOpen}
              />
            ) : (
              <span className="w-8" aria-hidden />
            ))}
        </div>

        <div className="min-w-0 flex-1 text-center">
          {title ? (
            <h1 className="truncate text-[15px] font-semibold leading-5 text-zinc-900">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="truncate text-[11px] leading-4 text-zinc-500">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-[4.5rem] shrink-0 items-center justify-end gap-0.5">
          {trailing ?? <span className="w-8" aria-hidden />}
        </div>
      </div>
    </header>
  );
}
