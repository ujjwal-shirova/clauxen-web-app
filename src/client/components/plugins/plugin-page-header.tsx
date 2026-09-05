"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
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
  backLabel = "All plugins",
  trailing,
}: PluginPageHeaderProps) {
  const { openMobileNav, isMobile, isSidebarCollapsed } = useAppLayout();
  const showMenu = isMobile && isSidebarCollapsed;

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200/70 bg-[var(--app-panel-bg,#fcfcfb)]">
      <div className="flex min-h-12 items-center gap-1 px-2 pt-[max(0.15rem,env(safe-area-inset-top))] sm:min-h-14 sm:gap-2 sm:px-4 lg:px-6">
        {showMenu ? (
          <MobileMenuButton
            onClick={openMobileNav}
            aria-controls="app-primary-nav"
            aria-expanded={!isSidebarCollapsed}
            className="-ml-0.5 border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-black/[0.05]"
          />
        ) : null}

        {backHref ? (
          <Link
            href={backHref}
            prefetch
            aria-label={backLabel}
            className="ui-icon-button shrink-0 text-zinc-600 hover:bg-black/[0.05] hover:text-zinc-950"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </Link>
        ) : null}

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.02em] text-zinc-900">
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
