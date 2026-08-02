"use client";

import { SiteFooter } from "@/marketing/components/site-footer";
import { SiteHeader } from "@/marketing/components/site-header";

/** Full-viewport scroll shell — chat app keeps body overflow:hidden. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-marketing-site=""
      className="fixed inset-0 z-[1] overflow-y-auto overscroll-y-contain bg-[radial-gradient(circle_at_50%_-12%,hsl(var(--brand)/0.12),transparent_30%),#f7f8fb] text-zinc-900 antialiased dark:bg-[var(--app-panel-bg)] dark:text-zinc-50"
    >
      <SiteHeader />
      <main className="min-h-[70vh]">{children}</main>
      <SiteFooter />
    </div>
  );
}
