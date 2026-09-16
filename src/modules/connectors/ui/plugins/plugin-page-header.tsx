"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAppLayout } from "@/components/app-layout-context";
import { MobileMenuButton } from "@/components/mobile-menu-button";

type PluginPageHeaderProps = {
  title: string;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
};

export function PluginPageHeader({
  title,
  backHref,
  backLabel = "All connectors",
  trailing,
}: PluginPageHeaderProps) {
  const { openMobileNav, isMobile, isSidebarCollapsed } = useAppLayout();
  const showMenu = isMobile && isSidebarCollapsed;

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]">
      <div className="mx-auto flex min-h-12 w-full max-w-[1120px] items-center gap-1 px-3 pt-[max(0.15rem,env(safe-area-inset-top))] sm:min-h-14 sm:gap-2 sm:px-6">
        {showMenu ? (
          <MobileMenuButton
            onClick={openMobileNav}
            aria-controls="app-primary-nav"
            aria-expanded={!isSidebarCollapsed}
            className="-ml-1 lg:flex"
          />
        ) : null}

        {backHref ? (
          <Link
            href={backHref}
            prefetch
            aria-label={backLabel}
            className="ui-icon-button shrink-0 text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </Link>
        ) : null}

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.02em] text-[var(--settings-fg)]">
          {title}
        </h1>

        {trailing ? (
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {trailing}
          </div>
        ) : null}
      </div>
    </header>
  );
}
